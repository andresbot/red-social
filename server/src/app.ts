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

// Servir archivos estáticos del frontend
const webPath = path.join(process.cwd(), '..', 'web');
app.use(express.static(webPath));
// Servir uploads
app.use('/uploads', express.static(path.join(webPath, 'uploads')));

// Ruta raíz: visitante.html si no está autenticado, index.html si tiene sesión
app.get('/', (req, res) => {
  // Verificar si hay token en headers Authorization
  const authHeader = req.headers.authorization;
  const hasToken = authHeader && authHeader.startsWith('Bearer ');
  
  if (hasToken) {
    // Usuario autenticado: mostrar dashboard
    res.sendFile(path.join(webPath, 'vistas', 'index.html'));
  } else {
    // Usuario visitante: mostrar landing page
    res.sendFile(path.join(webPath, 'vistas', 'visitante.html'));
  }
});

// Rutas para vistas de autenticación
app.get('/register', (_req, res) => {
  res.sendFile(path.join(webPath, 'vistas', 'register.html'));
});

app.get('/login', (_req, res) => {
  res.sendFile(path.join(webPath, 'vistas', 'login.html'));
});

app.get('/publicar-servicio', (_req, res) => {
  res.sendFile(path.join(webPath, 'vistas', 'publicar-servicio.html'));
});

app.get('/mis-servicios', (_req, res) => {
  res.sendFile(path.join(webPath, 'vistas', 'mis-servicios.html'));
});

app.get('/buscar-servicios', (_req, res) => {
  res.sendFile(path.join(webPath, 'vistas', 'buscar-servicios.html'));
});

app.get('/detalle-servicio', (_req, res) => {
  res.sendFile(path.join(webPath, 'vistas', 'detalle-servicio.html'));
});

app.get('/contratos', (_req, res) => {
  res.sendFile(path.join(webPath, 'vistas', 'contratos.html'));
});

app.get('/perfil', (_req, res) => {
  res.sendFile(path.join(webPath, 'vistas', 'perfil.html'));
});

app.get('/ver-perfil', (_req, res) => {
  res.sendFile(path.join(webPath, 'vistas', 'ver-perfil.html'));
});

app.get('/cartera', (_req, res) => {
  res.sendFile(path.join(webPath, 'vistas', 'cartera.html'));
});

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
