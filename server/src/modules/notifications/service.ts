// server/src/modules/notifications/service.ts
import { Pool, QueryResult } from 'pg';
import { onlineUsers } from '../messaging/ws'; 


// Tipos
export type NotificationChannel = 'web' | 'email' | 'push';
export type NotificationType =
  | 'new_message'
  | 'contract_updated'
  | 'transaction_completed'
  | 'service_updated'
  | 'rating_received'
  | 'dispute_created';

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceId?: string;
  actionUrl: string;
}

// Servicio principal
export class NotificationService {
  private dbPool: Pool;

  constructor(dbPool: Pool) {
    this.dbPool = dbPool;
  }

  // Crear notificación y emitir en tiempo real si el usuario está conectado
  async createNotification(params: CreateNotificationParams): Promise<void> {
    const { userId, type, title, message, referenceId, actionUrl } = params;

    // 1. Insertar en la base de datos (siempre en canal 'web')
    const insertRes = await this.dbPool.query(
      `INSERT INTO notifications 
       (user_id, type, title, message, reference_id, action_url, channel)
       VALUES ($1, $2, $3, $4, $5, $6, 'web')
       RETURNING id, created_at`,
      [userId, type, title, message, referenceId, actionUrl]
    );
    const notification = insertRes.rows[0];

    // 2. Verificar si el usuario tiene preferencias y si quiere notificaciones push
    const prefRes = await this.dbPool.query(
      'SELECT push_enabled FROM notification_preferences WHERE user_id = $1',
      [userId]
    );
    const pushEnabled = prefRes.rows.length > 0 ? prefRes.rows[0].push_enabled : true;

    // 3. Si el usuario está conectado y tiene push habilitado → emitir por WebSocket
    if (pushEnabled && onlineUsers.has(userId)) {
      const sockets = onlineUsers.get(userId)!;
      sockets.forEach(socket => {
        if (socket.connected) {
          socket.emit('new_notification', {
            id: notification.id,
            type,
            title,
            message,
            actionUrl,
            createdAt: notification.created_at
          });
        }
      });
    }

    // 4. (Futuro) Si el usuario quiere email → enviar email (no implementado ahora)
    // if (shouldSendEmail(type, emailPrefs)) { enviarEmail(...) }
  }

  // Obtener notificaciones no leídas del usuario
  async getUnreadCount(userId: string): Promise<number> {
    const res = await this.dbPool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );
    return parseInt(res.rows[0].count);
  }

  // Obtener últimas notificaciones (paginadas)
  async getNotifications(userId: string, limit = 20, offset = 0) {
    const res = await this.dbPool.query(
      `SELECT id, type, title, message, reference_id, action_url, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return res.rows;
  }

// Marcar una notificación como leída
    async markAsRead(userId: string, notificationId: string): Promise<boolean> {
        const res = await this.dbPool.query(
        'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING id',
        [notificationId, userId]
    );
    return res.rows.length > 0; 
    }

  // Marcar todas como leídas
  async markAllAsRead(userId: string): Promise<void> {
    await this.dbPool.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [userId]
    );
  }
}