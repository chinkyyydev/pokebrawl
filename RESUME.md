# PokéBrawl — Resume Notes (read this first on a new machine)

A Pokémon Showdown-style 1v1 battler with online multiplayer and (devnet) Solana
wagering. This file is the "pick up where we left off" guide.

- **Live site:** https://poke-brawl.com (served by Render)
- **GitHub:** https://github.com/chinkyyydev/pokebrawl
- **Render service:** `pokebrawl` (one web service serves the game + WebSocket battles)
- **Domain DNS:** Cloudflare (CNAME `@` and `www` → `pokebrawl.onrender.com`, DNS-only; SSL/TLS = Full)

## Set up on a fresh PC (Windows)

1. Install **Node.js 20+** and **Git** (e.g. `winget install OpenJS.NodeJS.LTS` and `winget install Git.Git`). Reopen the terminal.
2. `git clone https://github.com/chinkyyydev/pokebrawl.git`
3. `cd pokebrawl && npm install`
4. Run it locally (two terminals):
   - `npm run dev` → game at http://localhost:5173
   - `npm run server` → battle server at ws://localhost:8080 (needed for online play)
5. Typecheck/build: `npx tsc --noEmit -p tsconfig.json` and `npm run build`.
6. Deploy = just `git push` (Render auto-redeploys from `main`).

## What's built

- **Engine/data:** Pokémon Showdown via `@pkmn/sim` + `@pkmn/dex`. All 1025 Pokémon,
  accurate moves/types/abilities/legality, type chart, STAB, etc.
- **Team builder:** 3 teams × 3 Pokémon, 4 legal moves each, ability/nature/item with
  descriptions. Rules enforced: 4 moves, no duplicate Pokémon, no duplicate moves.
- **Competitive ban list** (`src/data/bans.ts`): Uber/AG Pokémon + OHKO/evasion moves +
  Moody/Shadow Tag/Arena Trap + evasion items. Shown as "BANNED", unselectable; server
  rejects banned teams (`teamBanViolation`).
- **8-bit shell:** title → character select (imported sprite roster in `public/trainers/`)
  → town → research center → battle stadium. Scenes in `src/App.tsx`.
- **Modes:** 🌐 Online (FREE PvP, wallet-free) + SOL wager tiers (wallet required), and 🤖
  Practice vs CPU. W/L record on the profile (online matches only).
- **Multiplayer:** authoritative WebSocket server (`server/index.ts`) runs the battle;
  clients send only choices. Matchmaking by stake tier. Single Render service also serves
  `dist/`. Client net layer: `src/net/client.ts` + `src/net/protocol.ts`; UI: `OnlineMatch.tsx`,
  shared battle visuals in `BattleField.tsx`.
- **Turn timer:** server-authoritative. 60s hidden → sends `timerWarning` → client shows a
  45s countdown → on timeout the server **auto-picks** a move (keeps the game moving).
- **Solana:** wallet connect via Phantom (`src/solana/wallet.tsx`), wallet sent as identity
  on online queue. On-chain **escrow Anchor program** written in `programs/pokebrawl-escrow/src/lib.rs`
  (NOT yet deployed/integrated — see below).
- **Refresh persistence:** the current scene is saved; refreshing resumes in town/research/
  lobby/builder instead of the title screen (`SCENE_KEY` in App.tsx).
- **Mobile:** responsive CSS (`@media (max-width: 720px)` in `src/styles.css`).

## TODO — next session (in priority order)

### 1. Disconnect / reconnect resume (the "switch tabs/apps without losing" feature)
Goal: switching apps/tabs mid-match doesn't instantly forfeit; you get a grace window to
return, mirroring **Pokémon TCG Pocket**. Design:
- **Client identity:** generate a persistent `playerId` (uuid in localStorage); send it in
  the `queue` message. Add a `{ type: 'resume'; playerId }` ClientMsg.
- **Server:** keep a `Map<playerId, Client>` for in-match players. On `ws.close` during a
  match, DON'T forfeit immediately — mark the client disconnected and start a **grace timer**;
  the existing turn timer auto-picks their moves meanwhile so the opponent isn't stuck. On a
  new socket sending `resume` with a known `playerId`, re-attach (`client.ws = newWs`), cancel
  the grace timer, and re-send current state. Forfeit only if grace expires.
- **Client:** `NetClient` auto-reconnects on unexpected close and sends `resume`; `OnlineMatch`
  shows "reconnecting…". Combine with refresh persistence so a full page reload can rejoin too.
- **Proposed timer values (verify against TCG Pocket, then tune):**
  - Move timer (have it): 60s hidden + 45s warning. Keep, or shorten on mobile.
  - **Desktop** disconnect grace: ~30s (browser tabs rarely drop the socket anyway).
  - **Mobile** disconnect grace: ~60–90s (app-switching suspends the socket).
  - Differentiate platform: client sends `platform: 'mobile' | 'desktop'` in `queue`; server
    picks grace length. (Detect mobile via `navigator.maxTouchPoints`/userAgent.)

### 2. Finish the Solana escrow (devnet)
- Deploy `programs/pokebrawl-escrow` via **Solana Playground** (beta.solpg.io) → get Program ID + IDL.
- Client: build `create_match`/`join_match` deposit txns from Phantom (needs `@solana/web3.js`).
- Server: hold an authority keypair; call `settle(winner)` when a wagered match ends; `refund`/`cancel` on draw/no-show.
- Add a rake (% of pot) in settle if desired. **Audit + legal before mainnet** (gambling + IP).

### 3. Nice-to-haves
- Show W/L on the result screen; persist teams/profile server-side keyed by wallet.
- Account-closing in the escrow to reclaim per-match rent.
- Replace placeholder trainer sprites / confirm their license (`CREDITS.md`).

## Gotchas / environment notes
- Windows + winget user-scope installs need a fresh terminal (or VS Code restart) to land on PATH.
- The throwaway `*.mts` scripts in the repo root are gitignored test helpers — ignore them.
- `asset-src/` (root) is gitignored downloaded research assets — not used by the build.
