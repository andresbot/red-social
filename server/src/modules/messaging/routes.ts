import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { pool } from '../../lib/db';
import { v4 as uuidv4 } from 'uuid';

export const messagingRouter = Router();

// Listar conversaciones del usuario
messagingRouter.get('/conversations', authenticate, async (req: any, res) => {
  try {
    const userId = req.userId;
    const r = await pool.query(
      `SELECT 
        c.*,
        u1.full_name AS user1_name,
        u2.full_name AS user2_name,
        u1.avatar AS user1_avatar,
        u2.avatar AS user2_avatar
       FROM conversations c
       JOIN users u1 ON c.user1_id = u1.id
       JOIN users u2 ON c.user2_id = u2.id
       WHERE c.user1_id = $1 OR c.user2_id = $1
       ORDER BY c.last_message_at DESC`,
      [userId]
    );
    res.json(r.rows);
  } catch (e: any) {
    console.error('Get conversations error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Listar mensajes de una conversación
messagingRouter.get('/conversations/:id/messages', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Verificar acceso
    const c = await pool.query(
      'SELECT user1_id, user2_id FROM conversations WHERE id = $1',
      [id]
    );
    if (c.rowCount === 0 || (c.rows[0].user1_id !== userId && c.rows[0].user2_id !== userId)) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const r = await pool.query(
      `SELECT 
        m.*,
        u.full_name AS sender_name,
        u.avatar AS sender_avatar
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC`,
      [id]
    );
    res.json(r.rows);
  } catch (e: any) {
    console.error('Get messages error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Crear conversación (si no existe)
messagingRouter.post('/conversations', authenticate, async (req: any, res) => {
  try {
    const { otherUserId, serviceId, initialMessage } = req.body;
    const userId = req.userId;

    if (!otherUserId) return res.status(400).json({ error: 'otherUserId es requerido' });

    // Verificar que ambos usuarios existen y son distintos
    if (userId === otherUserId) return res.status(400).json({ error: 'No puedes chatear contigo mismo' });

    const usersExist = await pool.query(
      'SELECT 1 FROM users WHERE id IN ($1, $2) AND is_active = true',
      [userId, otherUserId]
    );
    if (usersExist.rowCount !== 2) {
      return res.status(400).json({ error: 'Usuario no válido' });
    }

    // Ordenar IDs (user1_id < user2_id)
    const [user1_id, user2_id] = userId < otherUserId ? [userId, otherUserId] : [otherUserId, userId];

    // Buscar o crear conversación
    const conv = await pool.query(
      `INSERT INTO conversations (user1_id, user2_id, service_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user1_id, user2_id, service_id) 
       DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [user1_id, user2_id, serviceId || null]
    );

    const conversationId = conv.rows[0].id;

    // Si hay mensaje inicial, guardarlo
    if (initialMessage) {
      await pool.query(
        `INSERT INTO messages (id, conversation_id, sender_id, message, message_type)
         VALUES ($1, $2, $3, $4, 'text')`,
        [uuidv4(), conversationId, userId, initialMessage]
      );
    }

    res.status(201).json({ conversationId });
  } catch (e: any) {
    console.error('Create conversation error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});