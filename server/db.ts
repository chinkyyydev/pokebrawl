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

// --- Escrow settlement reliability -----------------------------------------
// A settle/refund/cancel call that fails (network hiccup, escrow authority
// briefly out of fees) gets recorded here instead of just console.error'd and
// lost — see server/index.ts's retry loop.

export type SettlementKind = 'settle' | 'refund' | 'cancel';
export interface SettlePayload { winner: string }
export interface RefundPayload { player1: string; player2: string }
export interface CancelPayload { player1: string }
export type SettlementPayload = SettlePayload | RefundPayload | CancelPayload;

export interface PendingSettlement {
  id: number;
  matchId: string;
  kind: SettlementKind;
  payload: SettlementPayload;
  attempts: number;
}

export async function recordFailedSettlement(
  matchId: number,
  kind: SettlementKind,
  payload: SettlementPayload,
  error: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO pending_settlements (match_id, kind, payload, attempts, last_error, last_attempt_at)
     VALUES ($1, $2, $3, 1, $4, now())`,
    [String(matchId), kind, JSON.stringify(payload), error],
  );
}

export async function listUnresolvedSettlements(): Promise<PendingSettlement[]> {
  const res = await pool.query(
    'SELECT id, match_id, kind, payload, attempts FROM pending_settlements WHERE resolved_at IS NULL ORDER BY created_at',
  );
  return res.rows.map((row) => ({
    id: row.id as number,
    matchId: row.match_id as string,
    kind: row.kind as SettlementKind,
    payload: row.payload as SettlementPayload,
    attempts: row.attempts as number,
  }));
}

export async function markSettlementAttemptFailed(id: number, error: string): Promise<void> {
  await pool.query(
    'UPDATE pending_settlements SET attempts = attempts + 1, last_error = $1, last_attempt_at = now() WHERE id = $2',
    [error, id],
  );
}

export async function markSettlementResolved(id: number): Promise<void> {
  await pool.query('UPDATE pending_settlements SET resolved_at = now() WHERE id = $1', [id]);
}

// --- Wagering kill-switch ----------------------------------------------------
// Persisted (not just in-memory) so a pause survives a server restart/redeploy
// — see /api/admin/wagering in server/index.ts.

export async function isWageringPaused(): Promise<boolean> {
  const res = await pool.query('SELECT wagering_paused FROM app_flags WHERE id = 1');
  return res.rows[0]?.wagering_paused ?? false;
}

export async function setWageringPaused(paused: boolean): Promise<void> {
  await pool.query(
    'INSERT INTO app_flags (id, wagering_paused) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET wagering_paused = $1',
    [paused],
  );
}
