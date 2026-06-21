# Server (placeholder — Milestone 2 & 3)

Nothing here runs yet. This folder marks where the authoritative game server and
Solana custodial layer will live. Planned shape:

```
server/
  index.ts            WebSocket server (ws or socket.io)
  matchmaking.ts      Queue keyed by stake tier (0.1 / 0.5 / 1 / 5 / 10 SOL)
  match.ts            Owns one @pkmn/sim Battle; relays protocol to both clients
  solana/
    escrow.ts         Devnet custodial wallet: verify deposits, pay out winner
    connection.ts     @solana/web3.js connection + keypair loading (from env)
```

## Why the battle must run server-side

In Milestone 1 the simulator runs in the browser, which is fine for solo play.
For PvP with money on the line, the client cannot be trusted to report results.
The server must own the `@pkmn/sim` Battle, receive only *choices* ("move 1",
"switch 3") from each client, validate them, and broadcast the resulting battle
log. Clients render; the server decides.

## Solana custodial flow (devnet first)

1. Both players connect a wallet (Phantom) and deposit their stake to a
   server-controlled escrow address.
2. Server confirms both deposits on-chain before starting the match.
3. Server runs the battle, determines the winner, and sends the pot (minus an
   optional rake) to the winner; refunds on draw/disconnect-timeout per rules.

Env vars to add later (never commit secrets):

```
SOLANA_RPC_URL=https://api.devnet.solana.com
ESCROW_SECRET_KEY=...   # base58 / json keypair, devnet only
RAKE_BPS=0
```

> ⚠️ Custodial means the server holds user funds — a security and regulatory
> liability. Audit before mainnet, or replace this with an on-chain Anchor
> escrow program so funds are never in a hot wallet you control.
