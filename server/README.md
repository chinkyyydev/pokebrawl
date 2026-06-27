# Server

Authoritative WebSocket + HTTP server for PokéBrawl. See `RESUME.md` at the
repo root for the full picture — this is just a quick map of what's here.

```
server/
  index.ts      HTTP + WebSocket server: matchmaking, the authoritative
                @pkmn/sim battle, deposit-gated wagering, accounts/auth APIs,
                the admin kill-switch, and the settlement-retry/monitoring loops
  auth.ts       Session tokens (JWT), password hashing, admin-secret check
  db.ts         Postgres (accounts, pending_settlements, app_flags)
  escrow.ts     Signs settle/refund/cancel against the on-chain escrow
                program — see programs/pokebrawl-escrow/src/lib.rs
  schema.sql    Run once against DATABASE_URL to create/update tables
```

## Why the battle runs server-side, not in the browser

With real money on the line, the client can't be trusted to report a
result. This server owns the `@pkmn/sim` Battle, receives only *choices*
("move 1", "switch 3") from each client, validates them, and broadcasts the
resulting battle log — clients render; the server decides.

## How wagering actually works (not custodial — funds never sit in a hot wallet)

Stakes are held by an on-chain Anchor escrow program
(`programs/pokebrawl-escrow`), not by this server directly. The server only
holds a single "authority" keypair (`ESCROW_AUTHORITY_SECRET`) that's allowed
to *sign* settle/refund/cancel once a match ends — it never has custody of
player funds itself, only the ability to instruct the on-chain program to
release stake to the right address. See `RESUME.md` for the full deposit
flow, the operational hardening (kill-switch, monitoring), and the audit
history.
