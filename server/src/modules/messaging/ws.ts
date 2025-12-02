import { Router } from 'express';
import type { Server } from 'socket.io';

export const messagingRouter = Router();

export function initMessagingSocket(io: Server) {
  io.on('connection', (socket) => {
    socket.on('join', (roomId: string) => socket.join(roomId));
    socket.on('message:send', (payload: { roomId: string; text: string }) => {
      io.to(payload.roomId).emit('message:new', { text: payload.text, at: Date.now() });
    });
  });
}
