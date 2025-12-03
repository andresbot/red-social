import { Router } from 'express';
import { pool } from '../../lib/db';
import { authenticate, AuthRequest } from '../../middleware/auth';
import multer from 'multer';
import path from 'path';

export const contractsRouter = Router();

// Configuración de subida de archivos de entrega
const uploadDir = path.join(process.cwd(), '..', 'web', 'uploads', 'contracts');
const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: (error: Error | null, destination: string) => void) => cb(null, uploadDir),
  filename: (_req: any, file: { originalname: string }, cb: (error: Error | null, filename: string) => void) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  }
});
const upload = multer({ storage });

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

// Subir archivos de entrega y marcar entregado (proveedor)
contractsRouter.post('/:id/deliver-files', authenticate, upload.array('files', 8), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    // Validaciones iniciales
    const cRes0 = await pool.query('SELECT * FROM contracts WHERE id=$1', [id]);
    if (cRes0.rowCount === 0) return res.status(404).json({ error: 'Contrato no encontrado' });
    const c0 = cRes0.rows[0];
    const isProvider0 = c0.seller_id === userId;
    if (!isProvider0) return res.status(403).json({ error: 'Solo el proveedor puede subir entregables' });
    if (!['accepted','in_progress'].includes(c0.status)) {
      return res.status(400).json({ error: 'El contrato debe estar aceptado o en progreso para entregar' });
    }
    if (!c0.escrow_id) {
      return res.status(400).json({ error: 'El contrato debe estar pagado antes de subir entregables' });
    }

    const files = (req.files as Express.Multer.File[]) || [];
    if (!files.length) return res.status(400).json({ error: 'No se enviaron archivos' });

    const urls = files.map(f => `/uploads/contracts/${f.filename}`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Bloquear contrato y actualizar entregables
      const cRes = await client.query('SELECT * FROM contracts WHERE id=$1 FOR UPDATE', [id]);
      const c = cRes.rows[0];

      const existing = Array.isArray(c.delivery_files) ? c.delivery_files : [];
      const merged = [...existing, ...urls];
      await client.query(
        `UPDATE contracts SET delivery_files=$2, delivered_at=NOW(), updated_at=NOW() WHERE id=$1`,
        [id, JSON.stringify(merged)]
      );

      // Liberar escrow y marcar completado automáticamente
      const amount = Number(c.total_amount_qz_halves || c.service_price_qz_halves);
      const fee = Number(c.platform_fee_qz_halves || 0);
      const sellerAmount = amount - fee;

      const escrowAccId = (await client.query(
        `SELECT id FROM accounts WHERE owner_type='escrow' AND owner_id=$1 AND currency='QZ'`, [c.escrow_id]
      )).rows[0]?.id;
      if (!escrowAccId) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(500).json({ error: 'Escrow account missing' });
      }

      const sellerAcc = await client.query(
        `INSERT INTO accounts (owner_type, owner_id, currency, name)
         SELECT 'user', $1, 'QZ', 'user_wallet_qz'
         WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE owner_type='user' AND owner_id=$1 AND currency='QZ')
         RETURNING id`,
        [c.seller_id]
      );
      const sellerAccId = sellerAcc.rowCount ? sellerAcc.rows[0].id : (await client.query(
        `SELECT id FROM accounts WHERE owner_type='user' AND owner_id=$1 AND currency='QZ'`, [c.seller_id]
      )).rows[0].id;

      const platformAcc = await client.query(
        `INSERT INTO accounts (owner_type, owner_id, currency, name)
         SELECT 'platform', NULL, 'QZ', 'platform_qz'
         WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE owner_type='platform' AND owner_id IS NULL AND currency='QZ')
         RETURNING id`
      );
      const platformAccId = platformAcc.rowCount ? platformAcc.rows[0].id : (await client.query(
        `SELECT id FROM accounts WHERE owner_type='platform' AND owner_id IS NULL AND currency='QZ'`
      )).rows[0].id;

      const txIns = await client.query(
        `INSERT INTO ledger_transactions (type, status, description, external_ref)
         VALUES ('payment','pending','Escrow release (auto-complete)', $1) RETURNING id`,
        [id]
      );
      const ltx = txIns.rows[0].id;

      if (fee > 0) {
        await client.query(
          `INSERT INTO ledger_entries (transaction_id, account_id, direction, amount_units)
           VALUES ($1,$2,'debit',$5), ($1,$3,'credit',$6), ($1,$4,'credit',$7)`,
          [ltx, escrowAccId, sellerAccId, platformAccId, amount, sellerAmount, fee]
        );
      } else {
        await client.query(
          `INSERT INTO ledger_entries (transaction_id, account_id, direction, amount_units)
           VALUES ($1,$2,'debit',$4), ($1,$3,'credit',$4)`,
          [ltx, escrowAccId, sellerAccId, amount]
        );
      }
      await client.query(`UPDATE ledger_transactions SET status='completed' WHERE id=$1`, [ltx]);

      await client.query(`UPDATE escrow_accounts SET status='released', released_at=NOW(), updated_at=NOW() WHERE id=$1`, [c.escrow_id]);
      const up = await client.query(
        `UPDATE contracts SET status='completed', completed_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *`,
        [id]
      );

      await client.query('COMMIT');
      client.release();
      return res.json(up.rows[0]);
    } catch (err) {
      await (client.query('ROLLBACK').catch(() => {}));
      client.release();
      console.error('Deliver files auto-complete error:', err);
      return res.status(500).json({ error: 'Error al completar automáticamente tras entrega' });
    }
  } catch (e: any) {
    console.error('Deliver files error:', e);
    res.status(500).json({ error: 'Server error', details: e.message });
  }
});

// Actualizar estado del contrato
contractsRouter.patch('/:id/status', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    let { status } = req.body;
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
      if (status === 'paid' && !['pending','accepted','in_progress'].includes(contract.status)) {
        return res.status(400).json({ error: 'Contract cannot be paid in current status' });
      }
      // Client puede cancelar si no está completado
      if (status === 'cancelled' && !['pending', 'paid', 'accepted', 'in_progress'].includes(contract.status)) {
        return res.status(400).json({ error: 'Cannot cancel contract in current status' });
      }
    }

    // Verificar valores disponibles en enum contract_status y aplicar fallback si faltan
    try {
      const enumCheck = await pool.query(
        `SELECT enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'contract_status'`
      );
      const available = new Set(enumCheck.rows.map(r => String(r.enumlabel)));
      if (status === 'accepted' && !available.has('accepted')) {
        // Fallback: si el enum no tiene 'accepted', pasamos directamente a 'in_progress'
        status = 'in_progress';
      }
      if (status === 'rejected' && !available.has('rejected')) {
        // Fallback: si el enum no tiene 'rejected', usamos 'cancelled'
        status = 'cancelled';
      }
    } catch (_) {
      // Si falla la verificación del enum, continuar sin fallback (intentará el update normal)
    }

    // Operaciones especiales para ciertos estados (escrow, pagos, etc.)
    if (status === 'paid' && isClient) {
      // Pagar contrato: mover fondos del comprador a escrow
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const cRes = await client.query('SELECT * FROM contracts WHERE id=$1 FOR UPDATE', [id]);
        const c = cRes.rows[0];
        // Permitir pagar en estados pending, accepted, in_progress
        if (!['pending','accepted','in_progress'].includes(c.status)) {
          await client.query('ROLLBACK');
          client.release();
          return res.status(400).json({ error: 'Contract cannot be paid in current status' });
        }

        const amount = Number(c.total_amount_qz_halves || c.service_price_qz_halves);
        const balRes = await client.query('SELECT balance_qz_halves FROM wallets WHERE user_id=$1 FOR UPDATE', [c.buyer_id]);
        const balance = Number(balRes.rows?.[0]?.balance_qz_halves || 0);
        if (balance < amount) {
          await client.query('ROLLBACK');
          client.release();
          return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Crear escrow account record
        const escIns = await client.query(
          `INSERT INTO escrow_accounts (service_id, buyer_id, seller_id, amount_qz_halves, status, funded_at)
           VALUES ($1,$2,$3,$4,'funded', NOW()) RETURNING id`,
          [c.service_id, c.buyer_id, c.seller_id, amount]
        );
        const escrowId = escIns.rows[0].id;

        // Ensure accounts
        const buyerAcc = await client.query(
          `INSERT INTO accounts (owner_type, owner_id, currency, name)
           SELECT 'user', $1, 'QZ', 'user_wallet_qz'
           WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE owner_type='user' AND owner_id=$1 AND currency='QZ')
           RETURNING id`,
          [c.buyer_id]
        );
        const buyerAccountId = buyerAcc.rowCount ? buyerAcc.rows[0].id : (await client.query(
          `SELECT id FROM accounts WHERE owner_type='user' AND owner_id=$1 AND currency='QZ'`, [c.buyer_id]
        )).rows[0].id;

        const escrowAcc = await client.query(
          `INSERT INTO accounts (owner_type, owner_id, currency, name)
           SELECT 'escrow', $1, 'QZ', 'escrow_qz'
           WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE owner_type='escrow' AND owner_id=$1 AND currency='QZ')
           RETURNING id`,
          [escrowId]
        );
        const escrowAccountId = escrowAcc.rowCount ? escrowAcc.rows[0].id : (await client.query(
          `SELECT id FROM accounts WHERE owner_type='escrow' AND owner_id=$1 AND currency='QZ'`, [escrowId]
        )).rows[0].id;

        // Ledger transaction
        const txIns = await client.query(
          `INSERT INTO ledger_transactions (type, status, description, external_ref)
           VALUES ('payment','pending','Contract payment', $1) RETURNING id`,
          [id]
        );
        const ltx = txIns.rows[0].id;
        await client.query(
          `INSERT INTO ledger_entries (transaction_id, account_id, direction, amount_units)
           VALUES ($1,$2,'debit',$4), ($1,$3,'credit',$4)`,
          [ltx, buyerAccountId, escrowAccountId, amount]
        );
        await client.query(`UPDATE ledger_transactions SET status='completed' WHERE id=$1`, [ltx]);

        // Update contract: if pending -> paid; if accepted/in_progress -> keep status and set escrow
        const newStatus = c.status === 'pending' ? 'paid' : c.status;
        const up = await client.query(
          `UPDATE contracts SET status=$2, escrow_id=$3, paid_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *`,
          [id, newStatus, escrowId]
        );

        await client.query('COMMIT');
        client.release();
        return res.json(up.rows[0]);
      } catch (err) {
        await (client.query('ROLLBACK').catch(() => {}));
        client.release();
        console.error('Pay contract error:', err);
        return res.status(500).json({ error: 'Failed to pay contract' });
      }
    }

    if (status === 'completed' && isClient) {
      // Liberar escrow al proveedor (menos fee de plataforma)
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const cRes = await client.query('SELECT * FROM contracts WHERE id=$1 FOR UPDATE', [id]);
        const c = cRes.rows[0];
        // Requerir pago previo (escrow creado) para completar
        if (!c.escrow_id) {
          await client.query('ROLLBACK');
          client.release();
          return res.status(400).json({ error: 'El contrato debe estar pagado antes de completar' });
        }
        const amount = Number(c.total_amount_qz_halves || c.service_price_qz_halves);
        const fee = Number(c.platform_fee_qz_halves || 0);
        const sellerAmount = amount - fee;

        // Accounts: escrow, seller, platform
        const escrowAccId = (await client.query(`SELECT id FROM accounts WHERE owner_type='escrow' AND owner_id=$1 AND currency='QZ'`, [c.escrow_id])).rows[0]?.id;
        if (!escrowAccId) {
          await client.query('ROLLBACK');
          client.release();
          return res.status(500).json({ error: 'Escrow account missing' });
        }
        const sellerAcc = await client.query(
          `INSERT INTO accounts (owner_type, owner_id, currency, name)
           SELECT 'user', $1, 'QZ', 'user_wallet_qz'
           WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE owner_type='user' AND owner_id=$1 AND currency='QZ')
           RETURNING id`,
          [c.seller_id]
        );
        const sellerAccId = sellerAcc.rowCount ? sellerAcc.rows[0].id : (await client.query(
          `SELECT id FROM accounts WHERE owner_type='user' AND owner_id=$1 AND currency='QZ'`, [c.seller_id]
        )).rows[0].id;

        const platformAcc = await client.query(
          `INSERT INTO accounts (owner_type, owner_id, currency, name)
           SELECT 'platform', NULL, 'QZ', 'platform_qz'
           WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE owner_type='platform' AND owner_id IS NULL AND currency='QZ')
           RETURNING id`
        );
        const platformAccId = platformAcc.rowCount ? platformAcc.rows[0].id : (await client.query(
          `SELECT id FROM accounts WHERE owner_type='platform' AND owner_id IS NULL AND currency='QZ'`
        )).rows[0].id;

        // Ledger transaction: debit escrow total, credit seller (amount-fee), credit platform (fee)
        const txIns = await client.query(
          `INSERT INTO ledger_transactions (type, status, description, external_ref)
           VALUES ('payment','pending','Escrow release', $1) RETURNING id`,
          [id]
        );
        const ltx = txIns.rows[0].id;
        // Build entries
        if (fee > 0) {
          await client.query(
            `INSERT INTO ledger_entries (transaction_id, account_id, direction, amount_units)
             VALUES ($1,$2,'debit',$5), ($1,$3,'credit',$6), ($1,$4,'credit',$7)`,
            [ltx, escrowAccId, sellerAccId, platformAccId, amount, sellerAmount, fee]
          );
        } else {
          await client.query(
            `INSERT INTO ledger_entries (transaction_id, account_id, direction, amount_units)
             VALUES ($1,$2,'debit',$4), ($1,$3,'credit',$4)`,
            [ltx, escrowAccId, sellerAccId, amount]
          );
        }
        await client.query(`UPDATE ledger_transactions SET status='completed' WHERE id=$1`, [ltx]);

        // Update escrow and contract
        await client.query(`UPDATE escrow_accounts SET status='released', released_at=NOW(), updated_at=NOW() WHERE id=$1`, [c.escrow_id]);
        const up = await client.query(
          `UPDATE contracts SET status='completed', completed_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *`,
          [id]
        );

        await client.query('COMMIT');
        client.release();
        return res.json(up.rows[0]);
      } catch (err) {
        await (client.query('ROLLBACK').catch(() => {}));
        client.release();
        console.error('Complete contract error:', err);
        return res.status(500).json({ error: 'Failed to complete contract' });
      }
    }

    if (status === 'cancelled' && isClient) {
      // Reembolso desde escrow al buyer si estaba pagado
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const cRes = await client.query('SELECT * FROM contracts WHERE id=$1 FOR UPDATE', [id]);
        const c = cRes.rows[0];
        if (c.status === 'pending') {
          const up = await client.query(`UPDATE contracts SET status='cancelled', updated_at=NOW() WHERE id=$1 RETURNING *`, [id]);
          await client.query('COMMIT');
          client.release();
          return res.json(up.rows[0]);
        }
        if (c.status !== 'paid' && c.status !== 'accepted' && c.status !== 'in_progress') {
          await client.query('ROLLBACK');
          client.release();
          return res.status(400).json({ error: 'Cannot refund in current status' });
        }
        if (!c.escrow_id) {
          await client.query('ROLLBACK');
          client.release();
          return res.status(400).json({ error: 'No escrow to refund' });
        }
        const amount = Number(c.total_amount_qz_halves || c.service_price_qz_halves);
        const escrowAccId = (await client.query(`SELECT id FROM accounts WHERE owner_type='escrow' AND owner_id=$1 AND currency='QZ'`, [c.escrow_id])).rows[0]?.id;
        const buyerAccId = (await client.query(`SELECT id FROM accounts WHERE owner_type='user' AND owner_id=$1 AND currency='QZ'`, [c.buyer_id])).rows[0]?.id || (await client.query(
          `INSERT INTO accounts (owner_type, owner_id, currency, name) VALUES ('user',$1,'QZ','user_wallet_qz') RETURNING id`, [c.buyer_id]
        )).rows[0].id;

        const txIns = await client.query(
          `INSERT INTO ledger_transactions (type, status, description, external_ref)
           VALUES ('refund','pending','Escrow refund', $1) RETURNING id`,
          [id]
        );
        const ltx = txIns.rows[0].id;
        await client.query(
          `INSERT INTO ledger_entries (transaction_id, account_id, direction, amount_units)
           VALUES ($1,$2,'debit',$4), ($1,$3,'credit',$4)`,
          [ltx, escrowAccId, buyerAccId, amount]
        );
        await client.query(`UPDATE ledger_transactions SET status='completed' WHERE id=$1`, [ltx]);

        await client.query(`UPDATE escrow_accounts SET status='refunded', updated_at=NOW() WHERE id=$1`, [c.escrow_id]);
        const up = await client.query(`UPDATE contracts SET status='cancelled', updated_at=NOW() WHERE id=$1 RETURNING *`, [id]);
        await client.query('COMMIT');
        client.release();
        return res.json(up.rows[0]);
      } catch (err) {
        await (client.query('ROLLBACK').catch(() => {}));
        client.release();
        console.error('Cancel contract error:', err);
        return res.status(500).json({ error: 'Failed to cancel contract' });
      }
    }

    // Actualizaciones simples con timestamps coherentes
    let simpleSql = `UPDATE contracts SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`;
    const params: any[] = [status, id];
    if (status === 'accepted') {
      simpleSql = `UPDATE contracts SET status=$1, accepted_at=NOW(), updated_at=NOW() WHERE id=$2 RETURNING *`;
    } else if (status === 'in_progress') {
      simpleSql = `UPDATE contracts SET status=$1, started_at=NOW(), updated_at=NOW() WHERE id=$2 RETURNING *`;
    } else if (status === 'delivered') {
      simpleSql = `UPDATE contracts SET status=$1, delivered_at=NOW(), updated_at=NOW() WHERE id=$2 RETURNING *`;
    }
    const result = await pool.query(simpleSql, params);

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
