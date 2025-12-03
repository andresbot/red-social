import { Router } from 'express';
import { pool } from '../../lib/db';
import { authenticate, AuthRequest } from '../../middleware/auth';

export const paymentsRouter = Router();

const EXCHANGE_RATE = Number(process.env.EXCHANGE_RATE_COP_PER_QZ || 10000); // 1 QZ = 10,000 COP

// Crear intención de compra de QZ (simulado para dev)
paymentsRouter.post('/purchase', authenticate, async (req: AuthRequest, res) => {
  try {
    const { qz_amount } = req.body; // en QZ, puede ser decimal (ej 15.5)
    const userId = req.userId!;

    const qz = Number(qz_amount);
    if (!qz || qz <= 0) return res.status(400).json({ error: 'Invalid qz_amount' });
    const halves = Math.round(qz * 2); // QZ halves entero
    const copCents = Math.round(qz * EXCHANGE_RATE * 100);

    // Create transaction pending
    const r = await pool.query(
      `INSERT INTO transactions (user_id, type, payment_method, status, amount_cop_cents, amount_qz_halves, description)
       VALUES ($1,'purchase','epayco','pending',$2,$3,$4) RETURNING id`,
      [userId, copCents, halves, 'Purchase QZ via ePayco']
    );
    const txId = r.rows[0].id;
    const payment_reference = 'EP-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    await pool.query(`UPDATE transactions SET payment_reference=$2 WHERE id=$1`, [txId, payment_reference]);

    // Normalmente devolveríamos URL/redireccion a ePayco
    res.status(201).json({
      transaction_id: txId,
      payment_reference,
      amount_cop: copCents / 100,
      qz_amount: qz,
      exchange_rate: EXCHANGE_RATE
    });
  } catch (e: any) {
    console.error('Create purchase error:', e);
    res.status(500).json({ error: 'Server error', details: e.message });
  }
});

// Webhook simulado / confirmación manual para dev
paymentsRouter.post('/mock-confirm', authenticate, async (req: AuthRequest, res) => {
  try {
    const { payment_reference } = req.body;
    const userId = req.userId!;
    if (!payment_reference) return res.status(400).json({ error: 'payment_reference required' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tx = await client.query(`SELECT * FROM transactions WHERE payment_reference=$1 FOR UPDATE`, [payment_reference]);
      if (tx.rowCount === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(404).json({ error: 'Transaction not found' });
      }
      const t = tx.rows[0];
      if (t.user_id !== userId) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (t.status !== 'pending') {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({ error: 'Transaction already processed' });
      }

      // Ensure accounts: platform QZ and user QZ
      const platAcc = await client.query(
        `INSERT INTO accounts (owner_type, owner_id, currency, name)
         SELECT 'platform', NULL, 'QZ', 'platform_qz'
         WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE owner_type='platform' AND owner_id IS NULL AND currency='QZ')
         RETURNING id`
      );
      const platformAccId = platAcc.rowCount ? platAcc.rows[0].id : (await client.query(
        `SELECT id FROM accounts WHERE owner_type='platform' AND owner_id IS NULL AND currency='QZ'`
      )).rows[0].id;

      const userAcc = await client.query(
        `INSERT INTO accounts (owner_type, owner_id, currency, name)
         SELECT 'user', $1, 'QZ', 'user_wallet_qz'
         WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE owner_type='user' AND owner_id=$1 AND currency='QZ')
         RETURNING id`,
        [t.user_id]
      );
      const userAccId = userAcc.rowCount ? userAcc.rows[0].id : (await client.query(
        `SELECT id FROM accounts WHERE owner_type='user' AND owner_id=$1 AND currency='QZ'`, [t.user_id]
      )).rows[0].id;

      // Ledger: move QZ from platform to user (minting from platform reserve)
      const ltx = await client.query(
        `INSERT INTO ledger_transactions (type, status, description, external_ref)
         VALUES ('topup','pending','Topup approved', $1) RETURNING id`,
        [t.id]
      );
      await client.query(
        `INSERT INTO ledger_entries (transaction_id, account_id, direction, amount_units)
         VALUES ($1,$2,'debit',$4), ($1,$3,'credit',$4)`,
        [ltx.rows[0].id, platformAccId, userAccId, Number(t.amount_qz_halves)]
      );
      await client.query(`UPDATE ledger_transactions SET status='completed' WHERE id=$1`, [ltx.rows[0].id]);

      // Mark transaction as completed
      await client.query(
        `UPDATE transactions SET status='completed', approved_at=NOW(), updated_at=NOW() WHERE id=$1`,
        [t.id]
      );
      await client.query('COMMIT');
      client.release();
      return res.json({ ok: true });
    } catch (err) {
      await (client.query('ROLLBACK').catch(() => {}));
      client.release();
      console.error('Mock confirm error:', err);
      return res.status(500).json({ error: 'Failed to confirm payment' });
    }
  } catch (e: any) {
    console.error('Mock confirm outer error:', e);
    res.status(500).json({ error: 'Server error', details: e.message });
  }
});
