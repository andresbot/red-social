import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { pool } from './db';

async function ensureMigrationsTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    filename TEXT UNIQUE NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
}

async function appliedSet(): Promise<Set<string>> {
  const res = await pool.query('SELECT filename FROM schema_migrations');
  return new Set(res.rows.map((r: any) => r.filename));
}

async function applyMigration(file: string, sql: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
    await client.query('COMMIT');
    console.log(`Applied: ${file}`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(`Failed: ${file}`, e);
    throw e;
  } finally {
    client.release();
  }
}

(async () => {
  await ensureMigrationsTable();
  const dir = join(process.cwd(), 'migrations');
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  const done = await appliedSet();
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = readFileSync(join(dir, f), 'utf8');
    await applyMigration(f, sql);
  }
  process.exit(0);
})();
