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
