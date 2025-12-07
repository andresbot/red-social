import { Router } from 'express';
import { pool } from '../../lib/db';
import { hashPassword, verifyPassword, signAccessToken } from '../../lib/auth';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  try {
    const { email, password, full_name, city } = req.body;
    const user_type = 'both';
    
    // Validación de campos
    if (!email || !password || !full_name || !city) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    // user_type por defecto 'both'
    
    // Hash de contraseña
    const hash = await hashPassword(password);
    
    // Insertar usuario
    const r = await pool.query(
      'INSERT INTO users (email, password, full_name, user_type, city) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, full_name, user_type, city',
      [email, hash, full_name, user_type, city]
    );
    
    // Generar token
    const token = signAccessToken({ userId: r.rows[0].id, role: user_type });
    
    // Responder con éxito
    res.status(201).json({ 
      token,
      user: {
        id: r.rows[0].id,
        email: r.rows[0].email,
        full_name: r.rows[0].full_name,
        user_type: r.rows[0].user_type
      }
    });
  } catch (e: any) {
    console.error('Register error:', e);
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Email exists' });
    }
    res.status(500).json({ error: 'Server error', details: e.message });
  }
});

authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    // 1) Intentar como admin primero (tabla admin_users con crypt)
    const ar = await pool.query(
      'SELECT au.id, au.password, ar.role_name FROM admin_users au JOIN admin_roles ar ON au.role_id=ar.id WHERE au.email=$1 AND au.is_active=true',
      [email]
    );
    // Si existe un admin con ese email, validar el password (crypt)
    if (ar.rowCount && ar.rowCount > 0) {
      const admin = ar.rows[0];
      const cmp = await pool.query('SELECT crypt($1, $2) = $2 AS ok',[password, admin.password]);
    if (!cmp.rows[0]?.ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signAccessToken({sub: admin.id,role: admin.role_name,scope: 'admin'});
    return res.json({ token, scope: 'admin', role: admin.role_name });
}

    // 2) Usuario normal (tabla users con argon2)
    const r = await pool.query('SELECT id, password, user_type FROM users WHERE email=$1 AND is_active=true', [email]);
    if (r.rowCount === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await verifyPassword(r.rows[0].password, password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signAccessToken({ userId: r.rows[0].id, role: r.rows[0].user_type, scope: 'user' });
    return res.json({ token, scope: 'user', role: r.rows[0].user_type });
  } catch (e: any) {
    console.error('Unified login error:', e);
    return res.status(500).json({ error: 'Server error', details: e.message });
  }
});
