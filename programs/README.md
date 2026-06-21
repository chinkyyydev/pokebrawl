# pokebrawl-escrow — on-chain stake escrow (Solana / Anchor)

Non-custodial escrow for 1v1 wagers. Both players' stakes are locked in a
program-owned PDA; the game server (the `authority`) signs a `settle` to pay the
winner the whole pot. **The server never holds the funds** — it only attests the
result.

## Instructions

| Instruction | Who signs | What it does |
|---|---|---|
| `create_match(match_id, stake, authority)` | player 1 | Opens a match PDA, deposits player 1's stake |
| `join_match` | player 2 | Deposits player 2's matching stake |
| `settle` (winner account) | **authority** (server) | Sends the full pot (2× stake) to the winner |
| `refund` | authority | Returns each stake to both players (draw/abort) |
| `cancel` | authority **or** player 1 | Refunds player 1 if nobody joined |

The match PDA is seeded by `["match", match_id]`, so the server picks a unique
`match_id` per game (it already generates match ids).

## Trust model
- ✅ Funds can only move per these rules — the server cannot drain arbitrary money.
- ⚠️ The server is the **result oracle**: it decides the winner and signs `settle`.
  Protect the authority key (a leak lets an attacker settle in-progress matches).
- ⚠️ v1 leaves ~0.0016 SOL of rent locked per match account (not closed). Fine for
  devnet; add account-closing / rent reclaim before mainnet.
- ⚠️ Get a professional **audit** before mainnet. This is unaudited.

## Deploy with Solana Playground (no local install)

1. Go to **https://beta.solpg.io**
2. Create a new project → **Anchor (Rust)**.
3. Replace the contents of `src/lib.rs` with [pokebrawl-escrow/src/lib.rs](pokebrawl-escrow/src/lib.rs).
4. Bottom-left: connect/create a Playground wallet, and set the network to **devnet**.
   Airdrop yourself some devnet SOL (`solana airdrop 2` in the Playground terminal,
   or the faucet button).
5. Run **Build** (🔨). Fix any errors with me if they appear.
6. Run **Deploy** (🚀). Playground writes the real program ID into `declare_id!`.
7. Copy two things and send them to me:
   - the **Program ID**
   - the **IDL** (Playground → the program's IDL tab, or `idl/pokebrawl_escrow.json`)

Then we wire the client (deposit) and server (settle) to it — all on devnet.

## Local build later (optional, via WSL)
For serious testing/auditing, install WSL + Rust + Solana CLI + Anchor and run
`anchor build && anchor deploy`. Not needed to get going.
