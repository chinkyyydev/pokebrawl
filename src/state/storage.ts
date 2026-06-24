import type { Team, TeamMember } from '../types';
import { DEFAULT_TRAINER, TRAINERS } from '../data/trainers';
import { teamBanViolation } from '../data/bans';

// A trainer profile and their saved teams — persisted server-side (Postgres,
// via server/db.ts), keyed by account. This file is imported by BOTH the
// client and the server (server/index.ts uses createProfile), so it must
// stay free of browser-only imports (fetch/localStorage/import.meta.env) —
// see src/state/profileApi.ts for the client-side fetch/push calls, and
// src/state/auth.tsx for sign-up/login/session-token handling.

export const TEAM_SLOTS = 3; // each player has 3 team slots
export const PARTY_SIZE = 3; // each team is 3 Pokémon
export const MOVES_PER_MON = 4; // every Pokémon must have all 4 moves

// Level milestones (= win count) that grant a free random Pokémon. Capped at
// 25 — past that, growing the collection requires buying with coin.
export const LEVEL_MILESTONES = [5, 10, 15, 20, 25];
export const BUY_COST = 20; // coin burned per "buy a Pokémon" purchase
export const WIN_COIN_REWARD = 5; // coin minted to the player per win
export const WELCOME_COIN_GRANT = 50; // one-time grant after the starter draft

// The 2 computer-picked Pokémon from the starter draft are on loan, not
// owned — after this long, each is swapped for a fresh random Pokémon.
export const RENTAL_HOURS = 24;
export const RENTAL_DURATION_MS = RENTAL_HOURS * 60 * 60 * 1000;

export interface Rental {
  species: string;
  expiresAt: number; // epoch ms — past this, the species rotates out
}

export interface SavedTeam {
  name: string;
  members: Team; // length PARTY_SIZE, nulls for empty slots
}

export interface Profile {
  name: string;
  trainer: string; // trainer sprite id (see data/trainers.ts)
  createdAt: number;
  teams: SavedTeam[]; // length TEAM_SLOTS
  activeTeam: number; // index into teams
  wins: number; // online (PvP) wins
  losses: number; // online (PvP) losses
  level: number; // = wins, kept explicit for display
  // Every Pokémon ever acquired, fully rolled (ability/nature/item/moves all
  // fixed permanently at acquisition time — see randomMember()) — gates team
  // building (TeamBuilder can only place species already in here).
  collection: TeamMember[];
  starterDraftDone: boolean; // one-time 3-choice free draft completed?
  rentals: Rental[]; // currently-on-loan species (subset of collection)
}

function emptyMembers(): Team {
  return Array.from({ length: PARTY_SIZE }, () => null);
}

export function emptyTeams(): SavedTeam[] {
  return Array.from({ length: TEAM_SLOTS }, (_, i) => ({
    name: `Team ${i + 1}`,
    members: emptyMembers(),
  }));
}

export function createProfile(name: string, trainer: string): Profile {
  return {
    name,
    trainer,
    createdAt: Date.now(),
    teams: emptyTeams(),
    activeTeam: 0,
    wins: 0,
    losses: 0,
    level: 0,
    collection: [],
    starterDraftDone: false,
    rentals: [],
  };
}

/** Defensively repairs a Profile's shape in case the schema grew or an older
 * save (e.g. pre-account localStorage data) has a stale structure. */
export function repairProfileShape(p: Profile): Profile {
  while (p.teams.length < TEAM_SLOTS) {
    p.teams.push({ name: `Team ${p.teams.length + 1}`, members: emptyMembers() });
  }
  p.teams.forEach((t) => {
    // Normalize to exactly PARTY_SIZE slots (handles older 6-slot saves).
    t.members = t.members.slice(0, PARTY_SIZE);
    while (t.members.length < PARTY_SIZE) t.members.push(null);
  });
  if (typeof p.activeTeam !== 'number') p.activeTeam = 0;
  if (!p.trainer || !TRAINERS.some((t) => t.id === p.trainer)) p.trainer = DEFAULT_TRAINER;
  if (typeof p.wins !== 'number') p.wins = 0;
  if (typeof p.losses !== 'number') p.losses = 0;
  if (typeof p.level !== 'number') p.level = p.wins;
  if (!Array.isArray(p.collection)) p.collection = [];
  // Migrate older saves: collection used to be string[] of species names,
  // then { species, shiny }[]. Normalize whatever shape shows up into a
  // (possibly incomplete) TeamMember — App.tsx's repairProfile() fills in
  // any missing ability/nature/item/moves with a fresh random roll.
  p.collection = (p.collection as unknown[]).map((raw) => {
    const e = raw as { species: string; shiny?: boolean; ability?: string };
    if (typeof raw === 'string') {
      return { species: raw, ability: '', item: '', moves: [], nature: 'Hardy', shiny: false };
    }
    if (!('ability' in e)) {
      return { species: e.species, ability: '', item: '', moves: [], nature: 'Hardy', shiny: !!e.shiny };
    }
    return e as TeamMember;
  });
  if (typeof p.starterDraftDone !== 'boolean') p.starterDraftDone = p.collection.length > 0;
  if (!Array.isArray(p.rentals)) p.rentals = [];
  return p;
}

/**
 * A team is battle-ready only when it's fully legal: all PARTY_SIZE Pokémon
 * present, each with exactly MOVES_PER_MON distinct moves, an ability set, and
 * no duplicate Pokémon across the team.
 */
export function teamIsReady(t: SavedTeam): boolean {
  return teamProblem(t) === null;
}

/** Returns a human-readable reason the team isn't ready, or null if it's valid. */
export function teamProblem(t: SavedTeam): string | null {
  const mons = t.members.filter((m): m is TeamMember => !!m);
  if (mons.length < PARTY_SIZE) return `Pick ${PARTY_SIZE} Pokémon`;

  const species = mons.map((m) => m.species.toLowerCase());
  if (new Set(species).size !== species.length) return 'No duplicate Pokémon';

  for (const m of mons) {
    if (!m.ability) return `${m.species} needs an ability`;
    const moves = m.moves.filter(Boolean);
    if (moves.length < MOVES_PER_MON) return `${m.species} needs ${MOVES_PER_MON} moves`;
    if (new Set(moves.map((x) => x.toLowerCase())).size !== moves.length) {
      return `${m.species} has duplicate moves`;
    }
  }
  return teamBanViolation(mons);
}

export function teamCount(t: SavedTeam): number {
  return t.members.filter(Boolean).length;
}
