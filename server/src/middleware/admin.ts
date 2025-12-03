import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../lib/db';

export interface AdminRequest extends Request {
  adminId?: string;
  adminRole?: string;
}

export function authenticateAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Admin auth required' });
  try {
    const secret = process.env.JWT_SECRET || 'dev_secret';
    const payload: any = jwt.verify(token, secret);
    if (!payload?.sub || payload?.scope !== 'admin') {
      return res.status(401).json({ error: 'Invalid admin token' });
    }
    req.adminId = payload.sub;
    req.adminRole = payload.role;
    next();
  } catch (e: any) {
    return res.status(401).json({ error: 'Invalid token', details: e.message });
  }
}

export function requireAdminRole(roles: string[] = []) {
  return async (req: AdminRequest, res: Response, next: NextFunction) => {
    if (!req.adminId) return res.status(401).json({ error: 'Admin auth required' });
    try {
      const a = await pool.query('SELECT au.id, ar.role_name FROM admin_users au JOIN admin_roles ar ON au.role_id = ar.id WHERE au.id=$1', [req.adminId]);
      if (a.rowCount === 0) return res.status(403).json({ error: 'Admin not found' });
      const role = String(a.rows[0].role_name);
      req.adminRole = role;
      if (roles.length && !roles.includes(role)) {
        return res.status(403).json({ error: 'Insufficient admin role' });
      }
      next();
    } catch (e: any) {
      return res.status(500).json({ error: 'Server error', details: e.message });
    }
  };
}
