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
   (Note: this only covers `src/` — `server/` isn't in `tsconfig.json`'s
   `include`, so `tsx` runs it untyped. Lean on actually running
   `npm run server` to catch issues there.)
6. Deploy = just `git push` (Render auto-redeploys from `main`).
7. Copy `.env.example` to `.env` and fill in `DATABASE_URL`/`JWT_SECRET` for
   accounts to work locally — see "Accounts" below.

## What's built

- **Accounts** (username/password or Phantom wallet, server-backed saves):
  sign up at `/api/signup`, log in at `/api/login`, wallet players hit
  `/api/wallet-login` (auto-login if their wallet has an account, otherwise
  prompts a one-time username claim — same `/api/signup` under the hood).
  Usernames are globally unique (case-insensitive) across *both* paths, and
  capped at `MAX_ACCOUNTS_PER_IP` (4) signups per IP — all enforced in
  `server/auth.ts` + `server/db.ts`. The whole `Profile` (teams/collection/
  coins/wins) now lives in Postgres as JSONB, keyed by account
  (`server/schema.sql`), fetched/pushed via `GET`/`PUT /api/profile`
  (Bearer token) — see `src/state/profileApi.ts` (client) and `src/state/
  auth.tsx` (`AuthProvider`/`useAuth`, holds the session token). Online
  matchmaking (`queue` over the WebSocket) now carries that token instead of
  a client-asserted name, so nobody can claim to be someone else mid-match
  (`server/index.ts`'s `case 'queue'`).
  **Database is live** — Neon Postgres, schema applied, working `.env`
  locally with `DATABASE_URL`/`JWT_SECRET`. Full flow verified end-to-end
  against the real DB: signup, duplicate-username rejection (case-
  insensitive), login + wrong-password rejection, wallet-login claim +
  auto-relogin, cross-namespace username collision (wallet account blocks a
  password signup with the same name and vice versa), the 4-accounts-per-IP
  cap, `GET`/`PUT /api/profile` round-tripping, and a full browser run
  (sign up → pick trainer → starter draft → Town → **page refresh resumes
  the same account**, not back at login). Passwords confirmed bcrypt-hashed
  in the DB, never plaintext.
  ### ⚠️ Outstanding: Render doesn't have the env vars yet
  `DATABASE_URL`/`JWT_SECRET` only exist in the local (gitignored) `.env` so
  far. Before deploying this, set both in Render's dashboard (already
  declared `sync: false` in `render.yaml` so they won't get overwritten by a
  blueprint sync) — **same values as the local `.env`** for `JWT_SECRET`
  (must match for tokens issued by one environment to verify in the other if
  you ever point both at the same DB), and the same Neon `DATABASE_URL`.
  Until that's set, signup/login/profile calls on the live site will fail
  soft with a 500 (verified non-fatal — doesn't crash the server) — the rest
  of the game is unaffected either way.
  ### Explicitly not done (see plan, ask before doing)
  - No password reset (no email collection) — a lost password means a new
    account for now.
  - No migration of old localStorage-only profiles into accounts — existing
    local saves (including dev/test ones) need a fresh sign-up.
  - No login rate-limiting.
- **Engine/data:** Pokémon Showdown via `@pkmn/sim` + `@pkmn/dex`. All 1025 Pokémon,
  accurate moves/types/abilities/legality, type chart, STAB, etc.
- **Team builder:** 3 teams × 3 Pokémon. You only choose *which* owned species
  fills a slot — ability, nature, item, and 4 moves are rolled once at
  acquisition and locked forever (see below); the editor shows them read-only
  with descriptions. Rules enforced: no duplicate Pokémon, no duplicate moves.
- **Permanent random ability/nature/item/moves** (`randomMember()` in
  `src/game/randomTeam.ts`): every Pokémon you ever get — starter draft, level
  drops, the shop, rental rotation, CPU teams — rolls a *fair* (uniform-odds)
  ability, nature, held item (or none, equally likely), and moveset the
  moment it's acquired, then that's fixed forever; `TeamBuilder` can no longer
  edit these fields at all. Moves guarantee 1-2 damaging picks (so nobody gets
  a 4-Status dud) then fill the rest fairly from the full legal pool. Nothing
  on the ban list (`src/data/bans.ts`) is ever rolled. `Profile.collection` is
  now `TeamMember[]` (was `{species, shiny}[]`) so the full rolled record
  persists; `loadProfile`'s migration backfills old shapes with blanks, and
  `App.tsx`'s `repairProfile()` catches anything still incomplete on load and
  rerolls it properly.
- **Ban list** (`src/data/bans.ts`): no species is banned anymore — Legendaries
  (Mythical/Restricted Legendary/Sub-Legendary, per `@pkmn/dex`'s own `tags`)
  are capped at **1 per team** instead (`isLegendary`, enforced in
  `teamBanViolation`; picker shows "★ LEGENDARY" and disables a 2nd pick once
  the team has one). OHKO/evasion moves + Moody/Shadow Tag/Arena Trap +
  evasion items are still banned outright. Server rejects violating teams
  (`teamBanViolation`, same function used client + server side).
- **Pokémon inventory** (`ResearchCenter.tsx`): below the 3 team cards, every
  species in `profile.collection` is listed (sorted by dex #) with its
  sprite, types, shiny/Legendary tags, rental countdown if still on loan, and
  which team (if any) it's currently slotted into.
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

- **Acquisition system (replaces free species browsing):** new trainers get a
  one-time 3-choice free draft (`StarterDraft.tsx`) — 1 chosen Pokémon is
  permanent; the other 2 auto-filled Team-1 slots are **rented for 24 hours**
  (`profile.rentals`) and auto-rotate to a new random species when the loan
  expires (`App.tsx`'s `rotateExpiredRentals`, checked on load + every 60s;
  shown as a "🕒 Rented · Xh left" badge in `TeamBuilder`). Winning matches
  levels you up (`level` = wins); every 5 levels up to 25 grants one more free
  random Pokémon, permanently (`App.tsx`'s `recordResult`). You can also buy
  coin using **$Pokebrawl** (the devnet SPL token, internally still called
  "PokéCoin" in code/`coin.ts`) to buy a Pokémon: pick 1 of 9 random options
  (`BuyPokemon.tsx`, "POKÉ SHOP" in Town). `TeamBuilder`'s species picker is
  now restricted to `profile.collection` (owned species, including current
  rentals) instead of the full 1025-species dex (`PokemonPicker`'s new `pool`
  prop). See `src/state/storage.ts` for `LEVEL_MILESTONES`/`BUY_COST`/
  `RENTAL_DURATION_MS`/coin-reward constants.
- **Species pool restricted to Gen 1-4, ranked by competitive tier:** every
  new Pokémon (starter draft, level drops, shop, rental rotation) is drawn
  from `competitiveSpecies()` (`src/data/pokedex.ts`) — National Dex #1-493
  only, ranked by the Smogon singles tier `@pkmn/dex` bundles per species
  (Uber → OU → … → PU/ZU → LC/NFE → untiered), top 400 kept (ties broken by
  base stat total). `allSpecies()` (full 1025) is still used for general
  lookups, e.g. resolving species a player already owns. To widen/narrow
  later gens or pool size, edit `GEN_1_TO_4_MAX_DEX`/`COMPETITIVE_POOL_SIZE`/
  `TIER_RANK` there.
- **Shiny variants (1/1000):** every acquisition path rolls `rollShiny()`
  (`src/game/shiny.ts`) independently of species. `TeamMember.shiny` and the
  parallel `profile.collection` entries (`CollectionEntry { species, shiny }`
  — replaced the old `string[]` shape, with a migration in `loadProfile`)
  carry it through to sprites everywhere: `monSprite`/`monSpriteAnim` take an
  optional `shiny` arg (`-shiny` sprite path suffix), and a "✨ Shiny" tag
  shows in `TeamBuilder`/`PokemonPicker`. Only the player's own Pokémon ever
  roll shiny — CPU/opponent teams never do.
- **Battle sprites are front-facing for both sides:** `BattleField.tsx`'s
  `MonImg` dropped the old back-view sprite for the player's own side
  (`monSpriteBack`/`monSpriteAnimBack` removed from `sprites.ts`) — both
  `Combatant`s now render the front (`ani`/`gen5`) sprite, shiny-aware via a
  new `shiny` prop threaded from the player's own team in `BattleView.tsx`/
  `OnlineMatch.tsx` (opponents' shininess isn't sent over the wire yet, so
  the foe side never shows shiny even if it secretly is).

### ⚠️ Outstanding: PokéCoin mint not yet created
`create-coin-mint.mts` (repo root, gitignored) creates the devnet SPL mint,
but the devnet faucet was rate-limited when this was built — the script's
mint-authority keypair (saved to `.secrets/coin-mint-authority.json`,
gitignored) was generated but never funded, so no mint exists yet. To finish:
1. Fund the printed authority address via <https://faucet.solana.com> (devnet),
   or just rerun `npx tsx create-coin-mint.mts` later — it reuses the same
   saved keypair instead of generating a new address each time.
2. Paste the printed mint address into `COIN_MINT_ADDRESS` in
   `src/solana/coin.ts` (replacing the `REPLACE_WITH_MINT_ADDRESS` placeholder).
3. Set `COIN_MINT_SECRET` (the JSON array from the `.secrets/` file) and
   `COIN_MINT_ADDRESS` as env vars for `npm run server` locally, and in
   Render's dashboard for production (already declared as `sync: false` in
   `render.yaml`).
Until then, `/api/claim-reward` (welcome grant, win reward) responds 503 and
the "POKÉ SHOP" buy flow can't burn coin — both fail soft (gameplay isn't
blocked, you just can't earn/spend coin yet).

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
