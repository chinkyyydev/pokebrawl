import type { Team, TeamMember } from '../types';
import { DEFAULT_TRAINER, TRAINERS } from '../data/trainers';
import { teamBanViolation } from '../data/bans';

// A trainer profile and their saved teams. Persisted to localStorage for now;
// when wallet/account auth lands, swap the KEY for the wallet address and move
// load/save to the backend — nothing else in the app needs to change.

export const TEAM_SLOTS = 3; // each player has 3 team slots
export const PARTY_SIZE = 3; // each team is 3 Pokémon
export const MOVES_PER_MON = 4; // every Pokémon must have all 4 moves

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
}

const KEY = 'pokemon1v1:profile';

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
  };
}

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Profile;
    if (!p?.name || !Array.isArray(p.teams)) return null;
    // Repair shape (in case the schema grew since this profile was saved).
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
    return p;
  } catch {
    return null;
  }
}

export function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // storage full / disabled — non-fatal for now
  }
}

export function clearProfile(): void {
  localStorage.removeItem(KEY);
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
