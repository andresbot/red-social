import { Router } from 'express';
import { pool } from '../../lib/db';
import { authenticate, AuthRequest } from '../../middleware/auth';

export const contractsRouter = Router();

// Crear contrato (cliente solicita servicio)
contractsRouter.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { service_id } = req.body;
    const buyer_id = req.userId!;

    if (!service_id) {
      return res.status(400).json({ error: 'service_id is required' });
    }

    // Obtener info del servicio
    const serviceQuery = await pool.query(
      'SELECT user_id, price_qz_halves, status, title, description, delivery_time FROM services WHERE id=$1',
      [service_id]
    );

    if (serviceQuery.rowCount === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const service = serviceQuery.rows[0];

    if (service.status !== 'active') {
      return res.status(400).json({ error: 'Service is not active' });
    }

    const seller_id = service.user_id;

    // No permitir contratar tu propio servicio
    if (seller_id === buyer_id) {
      return res.status(400).json({ error: 'Cannot contract your own service' });
    }

    // Verificar que no haya un contrato pendiente o en progreso para este servicio del mismo cliente
    const existingContract = await pool.query(
      "SELECT id FROM contracts WHERE buyer_id=$1 AND service_id=$2 AND status IN ('pending', 'paid', 'accepted', 'in_progress')",
      [buyer_id, service_id]
    );

    if (existingContract.rowCount && existingContract.rowCount > 0) {
      return res.status(400).json({ error: 'You already have an active contract for this service' });
    }

    // Generar número de contrato único
    const contract_number = `CTR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const delivery_days = parseInt(service.delivery_time) || 7;

    // Crear contrato
    const result = await pool.query(
      `INSERT INTO contracts (
        contract_number, buyer_id, seller_id, service_id, 
        title, description, service_price_qz_halves, 
        total_amount_qz_halves, delivery_days, status
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, 'pending')
       RETURNING *`,
      [contract_number, buyer_id, seller_id, service_id, service.title, service.description, service.price_qz_halves, delivery_days]
    );

    res.status(201).json(result.rows[0]);
  } catch (e: any) {
    console.error('Create contract error:', e);
    res.status(500).json({ error: 'Server error', details: e.message });
  }
});

// Listar contratos del usuario autenticado
contractsRouter.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { role } = req.query; // 'client' o 'provider'

    let query: string;
    if (role === 'client') {
      query = `
        SELECT c.*, s.title as service_title, s.category as service_category, s.image_url as service_image,
               u.full_name as provider_name, u.email as provider_email, c.seller_id as provider_id
        FROM contracts c
        JOIN services s ON c.service_id = s.id
        JOIN users u ON c.seller_id = u.id
        WHERE c.buyer_id = $1
        ORDER BY c.created_at DESC
      `;
    } else if (role === 'provider') {
      query = `
        SELECT c.*, s.title as service_title, s.category as service_category, s.image_url as service_image,
               u.full_name as client_name, u.email as client_email, c.buyer_id as client_id
        FROM contracts c
        JOIN services s ON c.service_id = s.id
        JOIN users u ON c.buyer_id = u.id
        WHERE c.seller_id = $1
        ORDER BY c.created_at DESC
      `;
    } else {
      // Devolver todos los contratos donde el usuario es cliente o proveedor
      query = `
        SELECT c.*, s.title as service_title, s.category as service_category, s.image_url as service_image,
               CASE WHEN c.buyer_id = $1 THEN 'client' ELSE 'provider' END as my_role,
               CASE WHEN c.buyer_id = $1 THEN seller.full_name ELSE buyer.full_name END as other_party_name
        FROM contracts c
        JOIN services s ON c.service_id = s.id
        LEFT JOIN users seller ON c.seller_id = seller.id
        LEFT JOIN users buyer ON c.buyer_id = buyer.id
        WHERE c.buyer_id = $1 OR c.seller_id = $1
        ORDER BY c.created_at DESC
      `;
    }

    const result = await pool.query(query, [userId]);
    res.json(result.rows);
  } catch (e: any) {
    console.error('List contracts error:', e);
    res.status(500).json({ error: 'Server error', details: e.message });
  }
});

// Actualizar estado del contrato
contractsRouter.patch('/:id/status', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.userId!;

    const validStatuses = ['pending', 'paid', 'accepted', 'rejected', 'in_progress', 'delivered', 'completed', 'disputed', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Obtener contrato actual
    const contractQuery = await pool.query(
      'SELECT * FROM contracts WHERE id=$1',
      [id]
    );

    if (contractQuery.rowCount === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const contract = contractQuery.rows[0];

    // Verificar permisos según el rol
    const isClient = contract.buyer_id === userId;
    const isProvider = contract.seller_id === userId;

    if (!isClient && !isProvider) {
      return res.status(403).json({ error: 'You are not part of this contract' });
    }

    // No permitir cambios si el contrato ya está en estado terminal
    const terminalStatuses = ['completed', 'cancelled', 'rejected'];
    if (terminalStatuses.includes(contract.status)) {
      return res.status(400).json({ error: `Cannot modify contract in ${contract.status} status` });
    }

    // Validar transiciones de estado según el schema completo
    // Provider puede: pending/paid -> accepted/rejected, accepted -> in_progress, in_progress -> delivered
    // Client puede: pending -> paid, delivered/in_progress -> completed, varios -> cancelled
    if (isProvider) {
      if ((contract.status === 'pending' || contract.status === 'paid') && !['accepted', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Provider can only accept or reject pending/paid contracts' });
      }
      if (contract.status === 'accepted' && status !== 'in_progress') {
        return res.status(400).json({ error: 'Provider can only start accepted contracts' });
      }
      if (contract.status === 'in_progress' && status !== 'delivered') {
        return res.status(400).json({ error: 'Provider can only mark in-progress contracts as delivered' });
      }
      // Provider no puede cancelar
      if (status === 'cancelled') {
        return res.status(403).json({ error: 'Only clients can cancel contracts' });
      }
    }

    if (isClient) {
      if (status === 'completed' && !['delivered', 'in_progress'].includes(contract.status)) {
        return res.status(400).json({ error: 'Can only complete delivered or in-progress contracts' });
      }
      if (status === 'paid' && contract.status !== 'pending') {
        return res.status(400).json({ error: 'Can only pay pending contracts' });
      }
      // Client puede cancelar si no está completado
      if (status === 'cancelled' && !['pending', 'paid', 'accepted', 'in_progress'].includes(contract.status)) {
        return res.status(400).json({ error: 'Cannot cancel contract in current status' });
      }
    }

    // Actualizar
    const result = await pool.query(
      'UPDATE contracts SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [status, id]
    );

    res.json(result.rows[0]);
  } catch (e: any) {
    console.error('Update contract status error:', e);
    res.status(500).json({ error: 'Server error', details: e.message });
  }
});

// Obtener detalle de un contrato
contractsRouter.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const result = await pool.query(
      `SELECT c.*, s.title as service_title, s.description as service_description, s.category as service_category,
              s.delivery_time, s.requirements, s.image_url as service_image,
              buyer.full_name as client_name, buyer.email as client_email,
              seller.full_name as provider_name, seller.email as provider_email
       FROM contracts c
       JOIN services s ON c.service_id = s.id
       JOIN users buyer ON c.buyer_id = buyer.id
       JOIN users seller ON c.seller_id = seller.id
       WHERE c.id = $1 AND (c.buyer_id = $2 OR c.seller_id = $2)`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Contract not found or access denied' });
    }

    res.json(result.rows[0]);
  } catch (e: any) {
    console.error('Get contract detail error:', e);
    res.status(500).json({ error: 'Server error', details: e.message });
  }
});
