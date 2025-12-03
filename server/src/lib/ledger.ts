import { pool } from './db';

export type Currency = 'QZ' | 'COP';
export type EntryDirection = 'debit' | 'credit';

export async function ensureAccount(ownerType: 'user' | 'escrow' | 'platform' | 'gateway', ownerId: string | null, currency: Currency, name?: string) {
  const r = await pool.query(
    'SELECT id FROM accounts WHERE owner_type=$1 AND owner_id IS NOT DISTINCT FROM $2 AND currency=$3 LIMIT 1',
    [ownerType, ownerId, currency]
  );
  if (r.rowCount && r.rows[0]?.id) return r.rows[0].id as string;
  const ins = await pool.query(
    'INSERT INTO accounts (owner_type, owner_id, currency, name) VALUES ($1,$2,$3,$4) RETURNING id',
    [ownerType, ownerId, currency, name || `${ownerType}_${currency}`]
  );
  return ins.rows[0].id as string;
}

export async function createLedgerTransaction(type: string, description: string, externalRef?: string) {
  const r = await pool.query(
    'INSERT INTO ledger_transactions (type, status, description, external_ref) VALUES ($1, $2, $3, $4) RETURNING id',
    [type, 'pending', description || '', externalRef || null]
  );
  return r.rows[0].id as string;
}

export async function postEntries(transactionId: string, entries: Array<{ accountId: string; direction: EntryDirection; amountUnits: number }>) {
  const values: any[] = [];
  const chunks: string[] = [];
  entries.forEach((e, i) => {
    values.push(transactionId, e.accountId, e.direction, e.amountUnits);
    const idx = i * 4;
    chunks.push(`($${idx + 1}, $${idx + 2}, $${idx + 3}::entry_direction, $${idx + 4})`);
  });
  await pool.query(
    `INSERT INTO ledger_entries (transaction_id, account_id, direction, amount_units) VALUES ${chunks.join(',')}`,
    values
  );
  // Mark tx as processing->completed in a simplified flow
  await pool.query('UPDATE ledger_transactions SET status=$2 WHERE id=$1', [transactionId, 'completed']);
}

export async function getOrCreateEscrowAccount(escrowId: string) {
  return ensureAccount('escrow', escrowId, 'QZ', 'escrow_qz');
}

export async function getUserQZAccount(userId: string) {
  return ensureAccount('user', userId, 'QZ', 'user_wallet_qz');
}

export async function getPlatformQZAccount() {
  return ensureAccount('platform', null, 'QZ', 'platform_qz');
}

export async function getWalletQZBalance(userId: string): Promise<number> {
  const r = await pool.query('SELECT balance_qz_halves FROM wallets WHERE user_id=$1', [userId]);
  return r.rows?.[0]?.balance_qz_halves ?? 0;
}
