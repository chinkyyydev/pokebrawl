-- Run this once against the Neon (or any Postgres) database referenced by
-- DATABASE_URL. Accounts hold the entire game Profile as JSONB so existing
-- game logic (src/state/storage.ts, etc.) doesn't need a relational redesign.
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  username_lower TEXT GENERATED ALWAYS AS (lower(username)) STORED,
  password_hash TEXT,           -- NULL for wallet-only accounts
  wallet_address TEXT,          -- NULL for password accounts
  signup_ip TEXT NOT NULL,
  profile JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS accounts_username_lower_idx ON accounts (username_lower);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_wallet_idx ON accounts (wallet_address) WHERE wallet_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS accounts_signup_ip_idx ON accounts (signup_ip);

-- A wagered match's settle/refund/cancel call that failed (network hiccup,
-- escrow authority briefly out of fees, etc.) gets durably recorded here
-- instead of just console.error'd and forgotten -- a background loop in
-- server/index.ts retries every unresolved row until it succeeds, including
-- after a server restart. The on-chain contract's own `settled` guard makes
-- retries safe (a second attempt at an already-settled match just fails
-- harmlessly), so retrying forever is the right default, not a fixed cap.
CREATE TABLE IF NOT EXISTS pending_settlements (
  id SERIAL PRIMARY KEY,
  match_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('settle', 'refund', 'cancel')),
  payload JSONB NOT NULL,        -- args needed to retry: winner, or player1/player2
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_attempt_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ        -- NULL until it succeeds
);

CREATE INDEX IF NOT EXISTS pending_settlements_unresolved_idx
  ON pending_settlements (created_at) WHERE resolved_at IS NULL;

-- Single-row runtime kill-switch — lets wagering be paused instantly via the
-- /api/admin/wagering endpoint (server/index.ts) without a redeploy, in case
-- the escrow authority key is ever suspected compromised. Free play/practice
-- are unaffected either way.
CREATE TABLE IF NOT EXISTS app_flags (
  id INT PRIMARY KEY DEFAULT 1,
  wagering_paused BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT app_flags_singleton CHECK (id = 1)
);
INSERT INTO app_flags (id, wagering_paused) VALUES (1, false) ON CONFLICT (id) DO NOTHING;
