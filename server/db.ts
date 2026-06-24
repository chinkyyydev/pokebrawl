// Postgres-backed accounts. Each account stores the entire game `Profile` as
// JSONB — reuses the existing serialization (src/state/storage.ts) instead of
// a relational redesign, so every game-logic function keeps working unchanged
// regardless of where the Profile is persisted.
import { Pool } from 'pg';
import type { Profile } from '../src/state/storage';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon (and most hosted Postgres) require TLS; skip only for a local DB.
  ssl: process.env.DATABASE_URL?.includes('localhost') ? undefined : { rejectUnauthorized: false },
});

export interface Account {
  id: number;
  username: string;
  password_hash: string | null;
  wallet_address: string | null;
  profile: Profile;
}

function rowToAccount(row: Record<string, unknown>): Account {
  return {
    id: row.id as number,
    username: row.username as string,
    password_hash: (row.password_hash as string | null) ?? null,
    wallet_address: (row.wallet_address as string | null) ?? null,
    profile: row.profile as Profile,
  };
}

export async function findByUsername(username: string): Promise<Account | null> {
  const res = await pool.query(
    'SELECT * FROM accounts WHERE username_lower = lower($1)',
    [username],
  );
  return res.rows[0] ? rowToAccount(res.rows[0]) : null;
}

export async function findByWallet(wallet: string): Promise<Account | null> {
  const res = await pool.query('SELECT * FROM accounts WHERE wallet_address = $1', [wallet]);
  return res.rows[0] ? rowToAccount(res.rows[0]) : null;
}

export async function findById(id: number): Promise<Account | null> {
  const res = await pool.query('SELECT * FROM accounts WHERE id = $1', [id]);
  return res.rows[0] ? rowToAccount(res.rows[0]) : null;
}

export async function countByIp(ip: string): Promise<number> {
  const res = await pool.query('SELECT count(*)::int AS n FROM accounts WHERE signup_ip = $1', [ip]);
  return res.rows[0]?.n ?? 0;
}

export async function createAccount(opts: {
  username: string;
  passwordHash: string | null;
  walletAddress: string | null;
  signupIp: string;
  profile: Profile;
}): Promise<Account> {
  const res = await pool.query(
    `INSERT INTO accounts (username, password_hash, wallet_address, signup_ip, profile)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [opts.username, opts.passwordHash, opts.walletAddress, opts.signupIp, JSON.stringify(opts.profile)],
  );
  return rowToAccount(res.rows[0]);
}

export async function saveProfile(accountId: number, profile: Profile): Promise<void> {
  await pool.query('UPDATE accounts SET profile = $1 WHERE id = $2', [
    JSON.stringify(profile),
    accountId,
  ]);
}
