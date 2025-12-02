import { Router, Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { pool } from '../../lib/db';
import { authenticate, optionalAuth, AuthRequest } from '../../middleware/auth';

export const servicesRouter = Router();

// Configuración de subida de imágenes
const uploadDir = path.join(process.cwd(), '..', 'web', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req: Request, _file: any, cb: (error: any, destination: string) => void) => cb(null, uploadDir),
  filename: (_req: Request, file: any, cb: (error: any, filename: string) => void) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi, '_');
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } });

servicesRouter.get('/', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { user_id } = req.query;
    
    // Si se solicita servicios de un usuario específico (query parameter)
    if (user_id) {
      // Solo mostrar servicios activos de ese usuario (para perfil público)
      const r = await pool.query(
        'SELECT id, user_id, title, category, description, price_qz_halves, delivery_time, requirements, image_url, status FROM services WHERE user_id=$1 AND status=$2 ORDER BY created_at DESC',
        [user_id, 'active']
      );
      return res.json(r.rows);
    }
    
    // Si el usuario está autenticado y no hay filtro, devolver sus servicios (activos e inactivos)
    if (req.userId) {
      const r = await pool.query(
        'SELECT id, user_id, title, category, description, price_qz_halves, delivery_time, requirements, image_url, status FROM services WHERE user_id=$1 ORDER BY created_at DESC',
        [req.userId]
      );
      return res.json(r.rows);
    }
    
    // Si no hay autenticación ni filtro, devolver todos los servicios activos
    const r = await pool.query(
      'SELECT id, user_id, title, category, description, price_qz_halves, delivery_time, requirements, image_url, status FROM services WHERE status=$1 ORDER BY created_at DESC',
      ['active']
    );
    res.json(r.rows);
  } catch (err) {
    console.error('Get services error:', err);
    res.status(500).json({ error: 'Failed to get services' });
  }
});

servicesRouter.get('/:id', async (req, res) => {
  const { id } = req.params;
  const r = await pool.query('SELECT * FROM services WHERE id=$1', [id]);
  if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  res.json(r.rows[0]);
});

servicesRouter.post('/', authenticate, upload.single('image'), async (req: AuthRequest & { file?: any }, res) => {
  try {
    const { title, category, description, price_qz_halves, delivery_time, requirements } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;
    
    // Validaciones
    if (!title || !category || !description || !price_qz_halves || !delivery_time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (title.length < 10 || title.length > 255) {
      return res.status(400).json({ error: 'Title must be between 10 and 255 characters' });
    }
    
    if (description.length < 50 || description.length > 5000) {
      return res.status(400).json({ error: 'Description must be between 50 and 5000 characters' });
    }
    
    if (price_qz_halves < 1) {
      return res.status(400).json({ error: 'Price must be at least 0.5 QZ (1 half)' });
    }
    
    // Usar userId del token JWT
    const user_id = req.userId!;
    
    // Insertar servicio
    const result = await pool.query(
      `INSERT INTO services (user_id, title, category, description, price_qz_halves, delivery_time, requirements, image_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
       RETURNING id, user_id, title, category, description, price_qz_halves, delivery_time, requirements, image_url, status, created_at`,
      [user_id, title, category, description, price_qz_halves, delivery_time, requirements, image_url]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (e: any) {
    console.error('Create service error:', e);
    res.status(500).json({ error: 'Server error', details: e.message });
  }
});

// Editar servicio
servicesRouter.patch('/:id', authenticate, upload.single('image'), async (req: AuthRequest & { file?: any }, res) => {
  try {
    const { id } = req.params;
    const { title, category, description, price_qz_halves, delivery_time, requirements } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : undefined;
    
    // Verificar que el servicio pertenece al usuario
    const ownerCheck = await pool.query('SELECT user_id FROM services WHERE id=$1', [id]);
    if (ownerCheck.rowCount === 0) return res.status(404).json({ error: 'Service not found' });
    if (ownerCheck.rows[0].user_id !== req.userId) {
      return res.status(403).json({ error: 'You do not own this service' });
    }

    // Validaciones básicas (si vienen)
    if (title && (title.length < 10 || title.length > 255)) {
      return res.status(400).json({ error: 'Title must be between 10 and 255 characters' });
    }
    if (description && (description.length < 50 || description.length > 5000)) {
      return res.status(400).json({ error: 'Description must be between 50 and 5000 characters' });
    }
    if (typeof price_qz_halves === 'number' && price_qz_halves < 1) {
      return res.status(400).json({ error: 'Price must be at least 0.5 QZ (1 half)' });
    }

    // Construir SET dinámico
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries({ title, category, description, price_qz_halves, delivery_time, requirements, image_url })) {
      if (value !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(value);
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);

    const sql = `UPDATE services SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const r = await pool.query(sql, values);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e: any) {
    console.error('Update service error:', e);
    res.status(500).json({ error: 'Server error', details: e.message });
  }
});

// Activar/Desactivar servicio (toggle)
servicesRouter.patch('/:id/toggle', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    // Verificar ownership
    const cur = await pool.query('SELECT user_id, status FROM services WHERE id=$1', [id]);
    if (cur.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    if (cur.rows[0].user_id !== req.userId) {
      return res.status(403).json({ error: 'You do not own this service' });
    }
    // Toggle estado actual
    const next = cur.rows[0].status === 'active' ? 'inactive' : 'active';
    const r = await pool.query('UPDATE services SET status=$1 WHERE id=$2 RETURNING id, status', [next, id]);
    res.json(r.rows[0]);
  } catch (e: any) {
    console.error('Toggle service error:', e);
    res.status(500).json({ error: 'Server error', details: e.message });
  }
});
