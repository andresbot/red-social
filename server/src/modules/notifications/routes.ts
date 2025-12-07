// server/src/modules/notifications/routes.ts
import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { NotificationService } from './service';
import { pool } from '../../lib/db';

// Inicializar el servicio 
const notificationService = new NotificationService(pool);

export const notificationsRouter = Router();

// GET /notifications/unread → { count: number }
notificationsRouter.get('/unread', authenticate, async (req: any, res) => {
  try {
    const count = await notificationService.getUnreadCount(req.userId);
    res.json({ count });
  } catch (err: any) {
    console.error('Get unread notifications error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /notifications → lista últimas 20
notificationsRouter.get('/', authenticate, async (req: any, res) => {
  try {
    const { limit = '20', offset = '0' } = req.query;
    const notifications = await notificationService.getNotifications(
      req.userId,
      parseInt(limit as string),
      parseInt(offset as string)
    );
    res.json(notifications);
  } catch (err: any) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /notifications/:id/read → marcar como leída
notificationsRouter.patch('/:id/read', authenticate, async (req: any, res) => {
  try {
    const success = await notificationService.markAsRead(req.userId, req.params.id);
    if (!success) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Mark notification as read error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /notifications/read-all → marcar todas como leídas
notificationsRouter.patch('/read-all', authenticate, async (req: any, res) => {
  try {
    await notificationService.markAllAsRead(req.userId);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Mark all notifications as read error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});