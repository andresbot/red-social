import { Router } from 'express';
import { pool } from '../../lib/db';
import { authenticate, AuthRequest } from '../../middleware/auth';

export const walletRouter = Router();

// Obtener balance de la cartera del usuario autenticado
walletRouter.get('/balance', authenticate, async (req: AuthRequest, res) => {
  try {
    const r = await pool.query(
      `SELECT balance_qz_halves, balance_cop_cents FROM wallets WHERE user_id=$1`,
      [req.userId]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Wallet not found' });
    const { balance_qz_halves, balance_cop_cents } = r.rows[0];
    res.json({
      balance_qz_halves: Number(balance_qz_halves) || 0,
      balance_qz: ((Number(balance_qz_halves) || 0) / 2),
      balance_cop_cents: Number(balance_cop_cents) || 0,
      balance_cop: ((Number(balance_cop_cents) || 0) / 100)
    });
  } catch (e: any) {
    console.error('Wallet balance error:', e);
    res.status(500).json({ error: 'Server error', details: e.message });
  }
});

// Listar transacciones recientes del usuario
walletRouter.get('/transactions', authenticate, async (req: AuthRequest, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query as any;
    const r = await pool.query(
      `SELECT id, type, payment_method, status, amount_cop_cents, amount_qz_halves, description, created_at
       FROM transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.userId, Number(limit), Number(offset)]
    );
    res.json(r.rows);
  } catch (e: any) {
    console.error('Wallet transactions error:', e);
    res.status(500).json({ error: 'Server error', details: e.message });
  }
});

// Dev: Top-up QZ balance for testing payments
walletRouter.post('/dev/topup', authenticate, async (req: AuthRequest, res) => {
  try {
    const { amount_qz } = req.body as any;
    const userId = req.userId!;
    const halves = Math.round(Number(amount_qz) * 2);
    if (!halves || halves <= 0) {
      return res.status(400).json({ error: 'amount_qz debe ser > 0' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Ensure accounts: user QZ and platform QZ
      const userAcc = await client.query(
        `INSERT INTO accounts (owner_type, owner_id, currency, name)
         SELECT 'user', $1, 'QZ', 'user_wallet_qz'
         WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE owner_type='user' AND owner_id=$1 AND currency='QZ')
         RETURNING id`,
        [userId]
      );
      const userAccId = userAcc.rowCount ? userAcc.rows[0].id : (await client.query(
        `SELECT id FROM accounts WHERE owner_type='user' AND owner_id=$1 AND currency='QZ'`, [userId]
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

      // Ledger transaction: platform -> user credit
      const txIns = await client.query(
        `INSERT INTO ledger_transactions (type, status, description)
         VALUES ('topup','pending','Dev top-up') RETURNING id`
      );
      const ltx = txIns.rows[0].id;
      await client.query(
        `INSERT INTO ledger_entries (transaction_id, account_id, direction, amount_units)
         VALUES ($1,$2,'debit',$4), ($1,$3,'credit',$4)`,
        [ltx, platformAccId, userAccId, halves]
      );
      await client.query(`UPDATE ledger_transactions SET status='completed' WHERE id=$1`, [ltx]);
      await client.query('COMMIT');
      client.release();
      return res.json({ ok: true, credited_qz: halves / 2 });
    } catch (err) {
      await (client.query('ROLLBACK').catch(() => {}));
      client.release();
      console.error('Dev topup error:', err);
      return res.status(500).json({ error: 'Failed to top-up' });
    }
  } catch (e: any) {
    console.error('Wallet topup error:', e);
    res.status(500).json({ error: 'Server error', details: e.message });
  }
});
