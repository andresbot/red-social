import { Router } from 'express';
import { pool } from '../../lib/db';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { hash, verify } from 'argon2';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadsDir = path.join(process.cwd(), '..', 'web', 'uploads', 'avatars');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const avatarUpload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif, webp)'));
  }
});

export const usersRouter = Router();

// Obtener perfil del usuario autenticado
usersRouter.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const r = await pool.query(
      'SELECT id, email, full_name, phone, city, user_type, avatar, bio, website, linkedin, github, twitter, portfolio, is_verified FROM users WHERE id=$1',
      [req.userId]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'User not found' });
    res.json(r.rows[0]);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to load user' });
  }
});

// Actualizar perfil del usuario autenticado
usersRouter.patch('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const { full_name, user_type, phone, city, bio, website, linkedin, github, twitter, portfolio } = req.body;

    if (!full_name || full_name.trim().length < 3) {
      return res.status(400).json({ error: 'El nombre debe tener al menos 3 caracteres' });
    }

    if (user_type && !['consumer', 'provider', 'both'].includes(user_type)) {
      return res.status(400).json({ error: 'Tipo de usuario inválido' });
    }

    const r = await pool.query(
      `UPDATE users SET 
        full_name = $1, 
        user_type = COALESCE($2, user_type),
        phone = $3, 
        city = $4, 
        bio = $5, 
        website = $6,
        linkedin = $7,
        github = $8,
        twitter = $9,
        portfolio = $10
      WHERE id = $11
      RETURNING id, email, full_name, phone, city, user_type, avatar, bio, website, linkedin, github, twitter, portfolio, is_verified`,
      [full_name.trim(), user_type, phone || null, city || null, bio || null, website || null, 
       linkedin || null, github || null, twitter || null, portfolio || null, req.userId]
    );

    if (r.rowCount === 0) return res.status(404).json({ error: 'User not found' });
    res.json(r.rows[0]);
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Cambiar contraseña del usuario autenticado
usersRouter.patch('/me/password', authenticate, async (req: AuthRequest, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Se requiere contraseña actual y nueva' });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
    }

    // Verificar contraseña actual
    const userResult = await pool.query('SELECT password FROM users WHERE id=$1', [req.userId]);
    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const valid = await verify(userResult.rows[0].password, current_password);
    if (!valid) {
      return res.status(403).json({ error: 'Contraseña actual incorrecta' });
    }

    // Hash nueva contraseña
    const hashedPassword = await hash(new_password);
    await pool.query('UPDATE users SET password=$1 WHERE id=$2', [hashedPassword, req.userId]);

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Avatar upload
usersRouter.patch('/me/avatar', authenticate, avatarUpload.single('avatar'), async (req: AuthRequest & { file?: any }, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó imagen' });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    // Obtener avatar anterior para eliminarlo
    const oldAvatar = await pool.query('SELECT avatar FROM users WHERE id=$1', [req.userId]);
    
    // Actualizar en BD
    const r = await pool.query(
      'UPDATE users SET avatar=$1 WHERE id=$2 RETURNING avatar',
      [avatarUrl, req.userId]
    );

    // Eliminar avatar anterior si existe
    if (oldAvatar.rows[0]?.avatar) {
      const oldPath = path.join(process.cwd(), '..', 'web', oldAvatar.rows[0].avatar);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    res.json({ avatar: r.rows[0].avatar });
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// Obtener rating del usuario
usersRouter.get('/me/rating', authenticate, async (req: AuthRequest, res) => {
  try {
    const r = await pool.query(`
      SELECT 
        COALESCE(AVG(r.rating), 0) as average_rating,
        COUNT(r.id) as total_ratings
      FROM services s
      LEFT JOIN ratings r ON s.id = r.service_id
      WHERE s.user_id = $1
      GROUP BY s.user_id
    `, [req.userId]);
    
    if (r.rowCount === 0 || r.rows[0].total_ratings === '0') {
      return res.json({ average_rating: null, total_ratings: 0 });
    }
    
    res.json({
      average_rating: parseFloat(r.rows[0].average_rating),
      total_ratings: parseInt(r.rows[0].total_ratings)
    });
  } catch (err) {
    console.error('Get rating error:', err);
    res.status(500).json({ error: 'Failed to get rating' });
  }
});

// Obtener skills del usuario
usersRouter.get('/me/skills', authenticate, async (req: AuthRequest, res) => {
  try {
    const r = await pool.query(
      'SELECT id, skill_name FROM user_skills WHERE user_id=$1 ORDER BY created_at ASC',
      [req.userId]
    );
    res.json(r.rows);
  } catch (err) {
    console.error('Get skills error:', err);
    res.status(500).json({ error: 'Failed to get skills' });
  }
});

// Agregar skill
usersRouter.post('/me/skills', authenticate, async (req: AuthRequest, res) => {
  try {
    const { skill_name } = req.body;
    
    if (!skill_name || skill_name.trim().length < 2) {
      return res.status(400).json({ error: 'El nombre de la habilidad debe tener al menos 2 caracteres' });
    }

    // Verificar que no exista ya
    const existing = await pool.query(
      'SELECT id FROM user_skills WHERE user_id=$1 AND LOWER(skill_name)=LOWER($2)',
      [req.userId, skill_name.trim()]
    );

    if (existing.rowCount > 0) {
      return res.status(400).json({ error: 'Esta habilidad ya existe' });
    }

    const r = await pool.query(
      'INSERT INTO user_skills (user_id, skill_name) VALUES ($1, $2) RETURNING id, skill_name, created_at',
      [req.userId, skill_name.trim()]
    );

    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error('Add skill error:', err);
    res.status(500).json({ error: 'Failed to add skill' });
  }
});

// Eliminar skill
usersRouter.delete('/me/skills/:skillId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { skillId } = req.params;
    const r = await pool.query(
      'DELETE FROM user_skills WHERE id=$1 AND user_id=$2',
      [skillId, req.userId]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    res.json({ message: 'Skill deleted' });
  } catch (err) {
    console.error('Delete skill error:', err);
    res.status(500).json({ error: 'Failed to delete skill' });
  }
});

// Obtener preferencias de notificaciones
usersRouter.get('/me/notification-preferences', authenticate, async (req: AuthRequest, res) => {
  try {
    const r = await pool.query(
      'SELECT email_transactions, email_messages, email_services, email_marketing, push_enabled FROM notification_preferences WHERE user_id=$1',
      [req.userId]
    );
    
    if (r.rowCount === 0) {
      // Crear preferencias por defecto
      const created = await pool.query(
        'INSERT INTO notification_preferences (user_id) VALUES ($1) RETURNING email_transactions, email_messages, email_services, email_marketing, push_enabled',
        [req.userId]
      );
      return res.json(created.rows[0]);
    }
    
    res.json(r.rows[0]);
  } catch (err) {
    console.error('Get preferences error:', err);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

// Actualizar preferencias de notificaciones
usersRouter.patch('/me/notification-preferences', authenticate, async (req: AuthRequest, res) => {
  try {
    const { email_transactions, email_messages, email_services, email_marketing, push_enabled } = req.body;

    const r = await pool.query(
      `INSERT INTO notification_preferences (user_id, email_transactions, email_messages, email_services, email_marketing, push_enabled)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET
         email_transactions = EXCLUDED.email_transactions,
         email_messages = EXCLUDED.email_messages,
         email_services = EXCLUDED.email_services,
         email_marketing = EXCLUDED.email_marketing,
         push_enabled = EXCLUDED.push_enabled,
         updated_at = CURRENT_TIMESTAMP
       RETURNING email_transactions, email_messages, email_services, email_marketing, push_enabled`,
      [req.userId, email_transactions, email_messages, email_services, email_marketing, push_enabled]
    );

    res.json(r.rows[0]);
  } catch (err) {
    console.error('Update preferences error:', err);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Obtener configuración de privacidad
usersRouter.get('/me/privacy-settings', authenticate, async (req: AuthRequest, res) => {
  try {
    const r = await pool.query(
      'SELECT show_email, show_phone, public_profile FROM privacy_settings WHERE user_id=$1',
      [req.userId]
    );
    
    if (r.rowCount === 0) {
      // Crear configuración por defecto
      const created = await pool.query(
        'INSERT INTO privacy_settings (user_id) VALUES ($1) RETURNING show_email, show_phone, public_profile',
        [req.userId]
      );
      return res.json(created.rows[0]);
    }
    
    res.json(r.rows[0]);
  } catch (err) {
    console.error('Get privacy settings error:', err);
    res.status(500).json({ error: 'Failed to get privacy settings' });
  }
});

// Actualizar configuración de privacidad
usersRouter.patch('/me/privacy-settings', authenticate, async (req: AuthRequest, res) => {
  try {
    const { show_email, show_phone, public_profile } = req.body;

    const r = await pool.query(
      `INSERT INTO privacy_settings (user_id, show_email, show_phone, public_profile)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         show_email = EXCLUDED.show_email,
         show_phone = EXCLUDED.show_phone,
         public_profile = EXCLUDED.public_profile,
         updated_at = CURRENT_TIMESTAMP
       RETURNING show_email, show_phone, public_profile`,
      [req.userId, show_email, show_phone, public_profile]
    );

    res.json(r.rows[0]);
  } catch (err) {
    console.error('Update privacy settings error:', err);
    res.status(500).json({ error: 'Failed to update privacy settings' });
  }
});

// Perfil público de usuario (respeta privacidad)
usersRouter.get('/:id/profile', async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener usuario
    const userResult = await pool.query(
      'SELECT id, full_name, user_type, avatar, bio, website, linkedin, github, twitter, portfolio, is_verified FROM users WHERE id=$1 AND is_active=true',
      [id]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Obtener configuración de privacidad
    const privacyResult = await pool.query(
      'SELECT show_email, show_phone, public_profile FROM privacy_settings WHERE user_id=$1',
      [id]
    );

    const privacy = privacyResult.rows[0] || { show_email: false, show_phone: false, public_profile: true };

    // Si el perfil no es público y no es el propio usuario
    if (!privacy.public_profile) {
      return res.status(403).json({ error: 'This profile is private' });
    }

    // Construir respuesta según configuración de privacidad
    const response: any = {
      id: user.id,
      full_name: user.full_name,
      user_type: user.user_type,
      avatar: user.avatar,
      bio: user.bio,
      website: user.website,
      linkedin: user.linkedin,
      github: user.github,
      twitter: user.twitter,
      portfolio: user.portfolio,
      is_verified: user.is_verified,
      show_email: privacy.show_email,
      show_phone: privacy.show_phone
    };

    // Agregar email y phone solo si la privacidad lo permite
    if (privacy.show_email) {
      const emailResult = await pool.query('SELECT email FROM users WHERE id=$1', [id]);
      response.email = emailResult.rows[0]?.email;
    }

    if (privacy.show_phone) {
      const phoneResult = await pool.query('SELECT phone, city FROM users WHERE id=$1', [id]);
      response.phone = phoneResult.rows[0]?.phone;
      response.city = phoneResult.rows[0]?.city;
    } else {
      const cityResult = await pool.query('SELECT city FROM users WHERE id=$1', [id]);
      response.city = cityResult.rows[0]?.city;
    }

    res.json(response);
  } catch (err) {
    console.error('Get public profile error:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Rating público de usuario
usersRouter.get('/:id/rating', async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(`
      SELECT 
        COALESCE(AVG(r.rating), 0) as average_rating,
        COUNT(r.id) as total_ratings
      FROM services s
      LEFT JOIN ratings r ON s.id = r.service_id
      WHERE s.user_id = $1
      GROUP BY s.user_id
    `, [id]);
    
    if (r.rowCount === 0 || r.rows[0].total_ratings === '0') {
      return res.json({ average_rating: null, total_ratings: 0 });
    }
    
    res.json({
      average_rating: parseFloat(r.rows[0].average_rating),
      total_ratings: parseInt(r.rows[0].total_ratings)
    });
  } catch (err) {
    console.error('Get user rating error:', err);
    res.status(500).json({ error: 'Failed to get rating' });
  }
});

// Skills públicas de usuario
usersRouter.get('/:id/skills', async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(
      'SELECT id, skill_name FROM user_skills WHERE user_id=$1 ORDER BY created_at ASC',
      [id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error('Get user skills error:', err);
    res.status(500).json({ error: 'Failed to get skills' });
  }
});

// Estadísticas de contratos de usuario
usersRouter.get('/:id/contracts-stats', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Contar contratos completados como cliente y proveedor
    const r = await pool.query(
      `SELECT 
        COUNT(CASE WHEN buyer_id = $1 AND status = 'completed' THEN 1 END) as completed_as_client,
        COUNT(CASE WHEN seller_id = $1 AND status = 'completed' THEN 1 END) as completed_as_provider,
        COUNT(CASE WHEN (buyer_id = $1 OR seller_id = $1) AND status = 'completed' THEN 1 END) as total_completed
      FROM contracts
      WHERE buyer_id = $1 OR seller_id = $1`,
      [id]
    );
    
    res.json({
      completed_as_client: parseInt(r.rows[0].completed_as_client) || 0,
      completed_as_provider: parseInt(r.rows[0].completed_as_provider) || 0,
      total_completed: parseInt(r.rows[0].total_completed) || 0
    });
  } catch (err) {
    console.error('Get contracts stats error:', err);
    res.status(500).json({ error: 'Failed to get contracts stats' });
  }
});

usersRouter.get('/:id', async (req, res) => {
  const { id } = req.params;
  const r = await pool.query('SELECT id, email, full_name, city, user_type, avatar, bio FROM users WHERE id=$1', [id]);
  if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  res.json(r.rows[0]);
});
