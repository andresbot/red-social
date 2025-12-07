import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg'; 

export const canSendMessage = async (conversationId: string, userId: string, dbPool: Pool): Promise<boolean> => {
  const r = await dbPool.query(
    'SELECT user1_id, user2_id FROM conversations WHERE id = $1',
    [conversationId]
  );
  if (r.rowCount === 0) return false;
  const conv = r.rows[0];
  return conv.user1_id === userId || conv.user2_id === userId;
};

export const createMessage = async (
  conversationId: string,
  senderId: string,
  content: string,
  type: 'text' | 'offer' | 'file' | 'system' = 'text',
  dbPool: Pool 
) => {
  const msgResult = await dbPool.query(
    `INSERT INTO messages (id, conversation_id, sender_id, message, message_type)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [uuidv4(), conversationId, senderId, content, type]
  );
  const message = msgResult.rows[0];

  const senderRes = await dbPool.query(
    'SELECT full_name FROM users WHERE id = $1',
    [senderId]
  );
  const senderName = senderRes.rows[0]?.full_name || 'Usuario';

  const convRes = await dbPool.query(
    'SELECT user1_id, user2_id FROM conversations WHERE id = $1',
    [conversationId]
  );
  const conv = convRes.rows[0];
  const recipientId = conv.user1_id === senderId ? conv.user2_id : conv.user1_id;

  const preview = content.length > 50 ? content.substring(0, 50) + '...' : content; 
  await dbPool.query(
  `INSERT INTO notifications (user_id, type, title, message, reference_id, action_url)
   VALUES ($1, 'new_message', 'Nuevo mensaje', $2, $3, $4)`,
  [recipientId, preview, conversationId, `/vistas/mensajes.html?conversationId=${conversationId}`]
  );

  return {
    ...message,
    sender: {
      id: senderId,
      full_name: senderName,
    },
  };
};