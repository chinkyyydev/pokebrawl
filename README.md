# Pokémon 1v1

A Pokémon Showdown-style 1v1 battle game with Solana stake-based matchmaking.
Players build a team of 6 from all 1025 Pokémon (4 moves each), match against an
opponent who staked the same amount of SOL, and the winner takes the pot.

## Status — Milestone 1 (local battle) ✅

What works in this scaffold:

- **Team builder** — choose from all 1025 Pokémon, pick an ability, nature, item,
  and 4 *legal* moves per Pokémon (move legality, types, power, and effects all
  come from Pokémon Showdown's real data via `@pkmn/dex`).
- **Battle engine** — battles run on `@pkmn/sim`, Showdown's actual simulator, so
  mechanics (type chart, abilities, status, weather, etc.) are accurate.
- **Local battle vs CPU** — a placeholder lobby lets you pick a stake tier and
  fight a randomly generated CPU team. SOL/payout is **mocked**.

Not built yet: real multiplayer, accounts, and the Solana custodial wallet
(see Roadmap). EVs/IVs are fixed (0 EVs, 31 IVs) for now.

## Prerequisites

- **Node.js 20+** and npm — *not currently installed on this machine.*
  Get it from <https://nodejs.org> (LTS), then reopen your terminal.

## Run it

```powershell
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

> First `npm install` pulls a large dataset (`@pkmn/*`). If install fails on the
> `latest` version ranges, run `npm install @pkmn/dex@latest @pkmn/sim@latest @pkmn/data@latest`
> and it will pin whatever resolves.

## Project layout

```
src/
  data/pokedex.ts        Wrappers over @pkmn/dex (species, moves, legal learnsets)
  game/
    battle.ts            BattleController around @pkmn/sim
    ai.ts                Simple CPU move picker
    randomTeam.ts        Random legal CPU team generator
  components/
    TeamBuilder.tsx       6-slot team editor
    PokemonPicker.tsx     Searchable all-1025 list
    MovePicker.tsx        Per-slot legal-move dropdown
    Lobby.tsx             Stake-tier selection (mock matchmaking)
    BattleView.tsx        Battle UI + turn loop
  App.tsx                Screen routing (team → lobby → battle)
  types.ts               TeamMember <-> PokemonSet conversion
server/                  Placeholder for Milestone 2/3 (see server/README.md)
```

## Roadmap

**Milestone 2 — Real multiplayer**
- Node server with WebSockets; relay choices between two clients.
- Run the authoritative `@pkmn/sim` battle on the server (never trust the client).
- Matchmaking queue keyed by stake tier.

**Milestone 3 — Solana (server custodial wallet)**
- Wallet connect (Phantom) on the client.
- Both players deposit their stake to a server-controlled escrow wallet **on devnet**.
- Server verifies deposits, runs the battle, pays the winner the pot (minus rake).
- ⚠️ Custodial = you hold user funds. Before mainnet: legal/regulatory review
  (this is gambling), KYC/AML, a security audit, and hot/cold wallet separation.
  Strongly consider an on-chain escrow program instead so you never custody funds.

## Important legal note

Wagering real cryptocurrency on game outcomes is gambling and is regulated
differently in every jurisdiction; it also violates the terms of most app stores
and many hosting/payment providers. This project defaults to Solana **devnet**
(no real value). Get qualified legal advice before handling real funds.
