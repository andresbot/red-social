import { Router } from 'express';
import { pool } from '../../lib/db';
import { authenticate, AuthRequest } from '../../middleware/auth';

export const ratingsRouter = Router();

// Crear calificación: solo comprador del contrato y contrato completado
ratingsRouter.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { contract_id, rating, comment } = req.body;
    const raterId = req.userId!;

    if (!contract_id || typeof rating !== 'number') {
      return res.status(400).json({ error: 'contract_id y rating son requeridos' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating debe estar entre 1 y 5' });
    }
    if (comment && comment.length > 500) {
      return res.status(400).json({ error: 'comment máximo 500 caracteres' });
    }

    // Verificar contrato y rol del rater
    const c = await pool.query(
      `SELECT id, service_id, buyer_id, seller_id, status FROM contracts WHERE id=$1`,
      [contract_id]
    );
    if (c.rowCount === 0) return res.status(404).json({ error: 'Contrato no encontrado' });
    const contract = c.rows[0];
    if (contract.buyer_id !== raterId) {
      return res.status(403).json({ error: 'Solo el comprador puede calificar este contrato' });
    }
    if (contract.status !== 'completed') {
      return res.status(400).json({ error: 'El contrato debe estar completado para calificar' });
    }

    // Evitar duplicados: una calificación por contrato del comprador
    const dup = await pool.query(
      `SELECT r.id FROM ratings r
       WHERE r.service_id=$1 AND r.user_id=$2
       LIMIT 1`,
      [contract.service_id, raterId]
    );
    if ((dup.rowCount ?? 0) > 0) {
      return res.status(409).json({ error: 'Ya existe una calificación para este contrato de este comprador' });
    }

    // Insertar rating
    const ins = await pool.query(
      `INSERT INTO ratings (service_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING id, service_id, user_id, rating, comment, created_at`,
      [contract.service_id, raterId, rating, comment || null]
    );

    // Enlazar rating al contrato (opcional)
    await pool.query(`UPDATE contracts SET rating_id=$1 WHERE id=$2`, [ins.rows[0].id, contract_id]);

    res.status(201).json(ins.rows[0]);
  } catch (err: any) {
    console.error('Create rating error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Listar calificaciones de un servicio (con promedio y total)
ratingsRouter.get('/service/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = '20', offset = '0', minRating } = req.query as any;

    const conditions: string[] = ['service_id = $1'];
    const values: any[] = [id];
    let idx = 2;
    if (minRating) {
      conditions.push(`rating >= $${idx}`);
      values.push(parseFloat(minRating as string));
      idx++;
    }

    const listSql = `SELECT id, user_id, rating, comment, created_at
                     FROM ratings
                     WHERE ${conditions.join(' AND ')}
                     ORDER BY created_at DESC
                     LIMIT $${idx} OFFSET $${idx + 1}`;
    values.push(parseInt(limit), parseInt(offset));

    const items = await pool.query(listSql, values);

    const countSql = `SELECT COUNT(*)::int AS total, AVG(rating)::float AS avg
                      FROM ratings WHERE ${conditions.join(' AND ')}`;
    const count = await pool.query(countSql, values.slice(0, -2));

    res.json({ items: items.rows, total: count.rows[0].total, avg: count.rows[0].avg || 0 });
  } catch (err: any) {
    console.error('List ratings error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Listar calificaciones recibidas por un proveedor (agregado por sus servicios)
ratingsRouter.get('/user/:id', async (req, res) => {
  try {
    const { id } = req.params; // provider id
    const { limit = '20', offset = '0' } = req.query as any;

    const listSql = `SELECT r.id, r.user_id AS rater_user_id, r.rating, r.comment, r.created_at, s.id AS service_id, s.title
                     FROM ratings r
                     JOIN services s ON r.service_id = s.id
                     WHERE s.user_id = $1
                     ORDER BY r.created_at DESC
                     LIMIT $2 OFFSET $3`;
    const items = await pool.query(listSql, [id, parseInt(limit), parseInt(offset)]);

    const aggSql = `SELECT COUNT(*)::int AS total, AVG(r.rating)::float AS avg
                    FROM ratings r JOIN services s ON r.service_id = s.id
                    WHERE s.user_id = $1`;
    const agg = await pool.query(aggSql, [id]);

    res.json({ items: items.rows, total: agg.rows[0].total, avg: agg.rows[0].avg || 0 });
  } catch (err: any) {
    console.error('List user ratings error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Listar calificaciones realizadas por un usuario (como comprador/rater)
ratingsRouter.get('/by-user/:id', async (req, res) => {
  try {
    const { id } = req.params; // rater user id
    const { limit = '20', offset = '0' } = req.query as any;

    const listSql = `SELECT r.id, r.rating, r.comment, r.created_at, s.id AS service_id, s.title
                     FROM ratings r
                     JOIN services s ON r.service_id = s.id
                     WHERE r.user_id = $1
                     ORDER BY r.created_at DESC
                     LIMIT $2 OFFSET $3`;
    const items = await pool.query(listSql, [id, parseInt(limit), parseInt(offset)]);

    const aggSql = `SELECT COUNT(*)::int AS total, AVG(r.rating)::float AS avg
                    FROM ratings r WHERE r.user_id = $1`;
    const agg = await pool.query(aggSql, [id]);

    res.json({ items: items.rows, total: agg.rows[0].total, avg: agg.rows[0].avg || 0 });
  } catch (err: any) {
    console.error('List ratings by user error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});
