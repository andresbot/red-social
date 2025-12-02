import { Router } from 'express';
import { pool } from '../../lib/db';
import { hashPassword, verifyPassword, signAccessToken } from '../../lib/auth';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  try {
    const { email, password, full_name } = req.body;
    const user_type = 'both';
    
    // Validación de campos
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    // user_type por defecto 'both'
    
    // Hash de contraseña
    const hash = await hashPassword(password);
    
    // Insertar usuario
    const r = await pool.query(
      'INSERT INTO users (email, password, full_name, user_type) VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, user_type',
      [email, hash, full_name, user_type]
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
  const { email, password } = req.body;
  const r = await pool.query('SELECT id, password FROM users WHERE email=$1', [email]);
  if (r.rowCount === 0) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await verifyPassword(r.rows[0].password, password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = signAccessToken({ userId: r.rows[0].id, role: 'user' });
  res.json({ token });
});
