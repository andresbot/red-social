import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extender tipo Request para incluir userId
export interface AuthRequest extends Request {
  userId?: string;
}

// Middleware de autenticación JWT
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7); // Remover "Bearer "
    const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

    const decoded = jwt.verify(token, secret) as { userId: string };
    
    if (!decoded.userId) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Middleware opcional: autenticación pero sin fallar si no hay token
export const optionalAuth = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
      const decoded = jwt.verify(token, secret) as { userId: string };
      req.userId = decoded.userId;
    }
  } catch (error) {
    // Continuar sin userId si el token es inválido
  }
  next();
};
