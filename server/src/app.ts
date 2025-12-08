import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { pool } from './lib/db';
import { authRouter } from './modules/auth/routes';
import { usersRouter } from './modules/users/routes';
import { servicesRouter } from './modules/services/routes';
import { messagingRouter } from './modules/messaging/routes';
import { initMessagingSocket } from './modules/messaging/ws';
import { contractsRouter } from './modules/contracts/routes';
import adminRouter from './modules/admin/routes';
import { serviceRequestsRouter } from './modules/service-requests/routes';
import { paymentsRouter } from './modules/payments/routes';
import { walletRouter } from './modules/wallet/routes';
import webhooksRouter from './modules/webhooks/routes';
import { ratingsRouter } from './modules/ratings/routes';
import { notificationsRouter } from './modules/notifications/routes';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: process.env.CORS_ORIGIN || '*', credentials: true }
});

// Middleware
app.use(express.json());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));

const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
  const webPath = path.join(process.cwd(), '..', 'web');
  app.use(express.static(webPath));
  app.use('/uploads', express.static(path.join(webPath, 'uploads')));

  // Rutas de vistas HTML (solo en desarrollo)
  const htmlRoutes = [
    '/', '/register', '/login', '/publicar-servicio',
    '/mis-servicios', '/buscar-servicios', '/detalle-servicio',
    '/contratos', '/perfil', '/ver-perfil', '/cartera'
  ];

  htmlRoutes.forEach(route => {
    app.get(route, (req, res) => {
      const view = route === '/' ? 'visitante.html' : route.slice(1) + '.html';
      const fullPath = path.join(webPath, 'vistas', view);
      res.sendFile(fullPath);
    });
  });
}

// Health
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'up' });
  } catch (e) {
    res.status(500).json({ ok: false, db: 'down' });
  }
});

// Routes
app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/services', servicesRouter);
app.use('/contracts', contractsRouter);
app.use('/admin', adminRouter);
app.use('/service-requests', serviceRequestsRouter);
app.use('/payments', paymentsRouter);
app.use('/wallet', walletRouter);
app.use('/webhooks', webhooksRouter);
app.use('/ratings', ratingsRouter);
app.use('/messaging', messagingRouter);
app.use('/notifications', notificationsRouter);

// Sockets
initMessagingSocket(io, pool);

// Robust process-level error logging to diagnose exit code 1
process.on('unhandledRejection', (reason: any) => {
  console.error('[unhandledRejection]', reason?.stack || reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.stack || err);
});

const port = Number(process.env.PORT || 3000);
try {
  server.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
} catch (err: any) {
  console.error('[server.listen error]', err?.stack || err);
  process.exit(1);
}
