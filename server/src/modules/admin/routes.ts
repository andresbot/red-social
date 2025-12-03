import { Router } from 'express';
import { pool } from '../../lib/db';
import { authenticateAdmin, requireAdminRole } from '../../middleware/admin';
import jwt from 'jsonwebtoken';

export const adminRouter = Router();

// Admin login
adminRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const r = await pool.query(
      'SELECT au.id, au.password, ar.role_name FROM admin_users au JOIN admin_roles ar ON au.role_id=ar.id WHERE au.email=$1',
      [email]
    );
    if (r.rowCount === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const admin = r.rows[0];
    // Compare bcrypt/pgcrypto hash via crypt
    const cmp = await pool.query('SELECT crypt($1, $2) = $2 AS ok', [password, admin.password]);
    if (!cmp.rows[0]?.ok) return res.status(401).json({ error: 'Invalid credentials' });
    const secret = process.env.JWT_SECRET || 'dev_secret';
    const token = jwt.sign({ sub: admin.id, role: admin.role_name, scope: 'admin' }, secret, { expiresIn: '8h' });
    res.json({ token, role: admin.role_name });
  } catch (e: any) {
    console.error('Admin login error:', e);
    res.status(500).json({ error: 'Server error', details: e.message });
  }
});

// List admin users (superadmin only)
adminRouter.get('/users', authenticateAdmin, requireAdminRole(['superadmin']), async (_req, res) => {
  try {
    const r = await pool.query(
      'SELECT au.id, au.email, au.full_name, au.is_active, ar.role_name, au.last_login, au.created_at FROM admin_users au JOIN admin_roles ar ON au.role_id=ar.id ORDER BY au.created_at DESC'
    );
    res.json(r.rows);
  } catch (e: any) {
    res.status(500).json({ error: 'Server error', details: e.message });
  }
});

// Create admin user (superadmin only)
adminRouter.post('/users', authenticateAdmin, requireAdminRole(['superadmin']), async (req, res) => {
  try {
    const { email, password, full_name, role_name } = req.body;
    if (!email || !password || !full_name || !role_name) return res.status(400).json({ error: 'Missing fields' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const role = await pool.query('SELECT id FROM admin_roles WHERE role_name=$1', [role_name]);
    if (role.rowCount === 0) return res.status(400).json({ error: 'Invalid role_name' });
    const r = await pool.query(
      `INSERT INTO admin_users (email, password, full_name, role_id, is_active) 
       VALUES ($1, crypt($2, gen_salt('bf')), $3, $4, true)
       RETURNING id, email, full_name`,
      [email, password, full_name, role.rows[0].id]
    );
    res.status(201).json(r.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: 'Server error', details: e.message });
  }
});

// Moderation: list services with optional status filter (moderator or superadmin)
adminRouter.get('/services', authenticateAdmin, requireAdminRole(['moderator','superadmin']), async (req, res) => {
  try {
    const { status } = req.query as { status?: string };
    let sql = `SELECT id, user_id, title, status, category, price_qz_halves, created_at, updated_at FROM services`;
    const params: any[] = [];
    if (status && ['active','inactive','paused'].includes(status)) {
      sql += ` WHERE status=$1`; params.push(status);
    }
    sql += ` ORDER BY created_at DESC`;
    const r = await pool.query(sql, params);
    res.json(r.rows);
  } catch (e: any) {
    res.status(500).json({ error: 'Server error', details: e.message });
  }
});

// Moderation: update service status (moderator or superadmin)
adminRouter.patch('/services/:id/status', authenticateAdmin, requireAdminRole(['moderator','superadmin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;
    if (!['active','inactive','paused'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const r = await pool.query(
      `UPDATE services SET status=$2, updated_at=NOW() WHERE id=$1 RETURNING id, title, status, updated_at`,
      [id, status]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Service not found' });
    // Optional: log admin action
    if (admin_notes) {
      await pool.query(
        `INSERT INTO analytics (user_id, action, entity_type, entity_id, metadata) VALUES (NULL, 'admin_service_status', 'service', $1, $2)`,
        [id, { status, admin_notes } as any]
      ).catch(() => {});
    }
    res.json(r.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: 'Server error', details: e.message });
  }
});

// Service reports: list and moderate (superadmin or moderator)
adminRouter.get('/reports', authenticateAdmin, requireAdminRole(['moderator','superadmin']), async (req, res) => {
  try {
    const { status } = req.query as { status?: string };
    let sql = `SELECT id, reporter_id, service_id, reason, status, reviewed_by, reviewed_at, admin_notes, created_at FROM service_reports`;
    const params: any[] = [];
    if (status && ['pending','reviewed','dismissed','action_taken'].includes(status)) { sql += ` WHERE status=$1`; params.push(status); }
    sql += ` ORDER BY created_at DESC`;
    const r = await pool.query(sql, params);
    res.json(r.rows);
  } catch (e: any) {
    res.status(500).json({ error: 'Server error', details: e.message });
  }
});

adminRouter.patch('/reports/:id', authenticateAdmin, requireAdminRole(['moderator','superadmin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;
    if (!['reviewed','dismissed','action_taken'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const r = await pool.query(
      `UPDATE service_reports SET status=$2, admin_notes=COALESCE($3, admin_notes), reviewed_at=NOW() WHERE id=$1 RETURNING *`,
      [id, status, admin_notes]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Report not found' });
    res.json(r.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: 'Server error', details: e.message });
  }
});

// Metrics: expose platform_metrics view (superadmin)
adminRouter.get('/metrics', authenticateAdmin, requireAdminRole(['superadmin']), async (_req, res) => {
  try {
    const r = await pool.query('SELECT * FROM platform_metrics');
    res.json(r.rows[0] || {});
  } catch (e: any) {
    res.status(500).json({ error: 'Server error', details: e.message });
  }
});

// Update admin user (superadmin only)
adminRouter.patch('/users/:id', authenticateAdmin, requireAdminRole(['superadmin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, is_active, role_name } = req.body;
    const fields: string[] = []; const values: any[] = []; let idx = 1;
    if (full_name) { fields.push(`full_name=$${idx++}`); values.push(full_name); }
    if (typeof is_active === 'boolean') { fields.push(`is_active=$${idx++}`); values.push(is_active); }
    if (role_name) {
      const role = await pool.query('SELECT id FROM admin_roles WHERE role_name=$1', [role_name]);
      if (role.rowCount === 0) return res.status(400).json({ error: 'Invalid role_name' });
      fields.push(`role_id=$${idx++}`); values.push(role.rows[0].id);
    }
    if (!fields.length) return res.status(400).json({ error: 'No changes provided' });
    values.push(id);
    const sql = `UPDATE admin_users SET ${fields.join(', ')}, updated_at=NOW() WHERE id=$${idx} RETURNING id, email, full_name, is_active`;
    const r = await pool.query(sql, values);
    res.json(r.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: 'Server error', details: e.message });
  }
});

export default adminRouter;
