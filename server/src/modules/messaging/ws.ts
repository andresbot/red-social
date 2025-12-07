import { Server as SocketIOServer, Socket } from 'socket.io';
import { Router } from 'express';
import { Pool } from 'pg'; 
import { verifySocketToken } from './auth';
import { ConversationRow } from './types';
import { canSendMessage, createMessage } from './service';
import { SendMessagePayload, NewMessageEvent } from './types';
import { QueryResult } from 'pg';

export const messagingRouter = Router();

export const onlineUsers = new Map<string, Set<Socket>>();

// Recibe el pool como segundo argumento
export const initMessagingSocket = (io: SocketIOServer, dbPool: Pool) => {
  io.on('connection', async (socket: Socket) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token?.toString();
    const authPayload = verifySocketToken(token as string);
    
    if (!authPayload) {
      socket.disconnect(true);
      return;
    }

    const userId = authPayload.userId;

    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId)!.add(socket);

    console.log(`[Messaging] Usuario conectado: ${userId}`);

    socket.on('send_message', async (payload: SendMessagePayload) => {
  try {
    const { conversationId, content, type = 'text' } = payload;

    if (!conversationId || !content) {
      socket.emit('error', { message: 'conversationId y content son requeridos' });
      return;
    }

    if (!(await canSendMessage(conversationId, userId, dbPool))) {
      socket.emit('error', { message: 'No tienes permiso para enviar en esta conversación' });
      return;
    }

    const enrichedMessage = await createMessage(conversationId, userId, content, type, dbPool);

    // Obtener destinatario
    const convRes = await dbPool.query<ConversationRow>(
      'SELECT user1_id, user2_id FROM conversations WHERE id = $1',
      [conversationId]
    );
    if (convRes.rows.length > 0) {
      const conv = convRes.rows[0];
      const recipientId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;
      const recipientSockets = onlineUsers.get(recipientId);
      if (recipientSockets) {
        recipientSockets.forEach(sock => {
          if (sock.connected) {
            sock.emit('new_message', enrichedMessage as NewMessageEvent);
          }
        });
      }
    }

    // EMITIR TAMBIÉN AL EMISOR
    socket.emit('new_message', enrichedMessage as NewMessageEvent);

    // 👇 NUEVO: Emitir evento para actualizar la lista de conversaciones
    // Enviamos el ID de la conversación y el preview del mensaje
    const preview = content.length > 50 ? content.substring(0, 50) + '...' : content;
    const updateEvent = {
      conversationId: conversationId,
      lastMessagePreview: preview,
      lastMessageAt: new Date().toISOString()
    };

    // Notificar a ambos usuarios (emisor y destinatario)
    const allUserIds = [
      userId,
      ...convRes.rows.map(r => r.user1_id === userId ? r.user2_id : r.user1_id)
    ];
    for (const uid of allUserIds) {
      const userSockets = onlineUsers.get(uid);
      if (userSockets) {
        userSockets.forEach(sock => {
          if (sock.connected) {
            sock.emit('conversation_updated', updateEvent);
          }
        });
      }
    }

    } catch (err: any) {
      console.error('[Messaging] Error en send_message:', err);
      socket.emit('error', { message: 'Error al enviar mensaje', details: err.message });
    }
  });

    socket.on('read_message', async ({ messageId }: { messageId: string }) => {
      try {
        const r = await dbPool.query(
          'SELECT sender_id FROM messages WHERE id = $1',
          [messageId]
        );
        if (r.rowCount === 0 || r.rows[0].sender_id === userId) return;

        await dbPool.query(
          'UPDATE messages SET is_read = true, read_at = NOW() WHERE id = $1',
          [messageId]
        );

        socket.emit('message_read', { messageId });
      } catch (err) {
        console.error('[Messaging] Error en read_message:', err);
      }
    });

    socket.on('disconnect', () => {
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket);
        if (userSockets.size === 0) onlineUsers.delete(userId);
      }
      console.log(`[Messaging] Usuario desconectado: ${userId}`);
    });
  });
};