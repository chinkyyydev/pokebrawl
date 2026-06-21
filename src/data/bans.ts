// Competitive ban list, based on Smogon's standard singles rules.
// Nothing is deleted from the game — these just can't be selected in the team
// builder (they show a "BANNED" tag), the same idea as Smogon's clauses.
//
// Sources: Smogon clauses (OHKO, Evasion, Species) + standard OU banlist.
import { Dex, toID } from '@pkmn/dex';

// --- Pokémon: Smogon's Uber + Anything-Goes tiers are too strong for standard play.
export function isSpeciesBanned(name: string): boolean {
  const tier = Dex.species.get(name).tier;
  return tier === 'Uber' || tier === 'AG';
}

// --- Moves: OHKO Clause + Evasion Clause + a few individually-banned staples.
const BANNED_MOVE_IDS = new Set([
  'fissure', 'guillotine', 'horndrill', 'sheercold', // OHKO Clause
  'doubleteam', 'minimize', // Evasion Clause
  'batonpass', 'lastrespects', 'swagger', // commonly banned in standard play
]);
export function isMoveBanned(name: string): boolean {
  return BANNED_MOVE_IDS.has(toID(name));
}

// --- Abilities banned in standard OU.
const BANNED_ABILITY_IDS = new Set(['moody', 'shadowtag', 'arenatrap']);
export function isAbilityBanned(name: string): boolean {
  return BANNED_ABILITY_IDS.has(toID(name));
}

// --- Items: Evasion Items Clause.
const BANNED_ITEM_IDS = new Set(['brightpowder', 'laxincense']);
export function isItemBanned(name: string): boolean {
  return BANNED_ITEM_IDS.has(toID(name));
}

// --- Natures: none are banned in competitive play (kept for symmetry).
export function isNatureBanned(_name: string): boolean {
  return false;
}

// --- Team-level check. Structurally typed so both the client's `TeamMember`
// and the sim's `PokemonSet` satisfy it — this is the single source of truth
// used by the team-builder UI AND the authoritative server (never trust the
// client with money on the line). Returns a human-readable reason or null.
export interface BannableMember {
  species: string;
  ability?: string;
  item?: string;
  moves: (string | undefined)[];
}
export function teamBanViolation(members: BannableMember[]): string | null {
  for (const m of members) {
    if (isSpeciesBanned(m.species)) return `${m.species} is banned`;
    if (m.ability && isAbilityBanned(m.ability)) {
      return `${m.species}'s ability ${m.ability} is banned`;
    }
    if (m.item && isItemBanned(m.item)) {
      return `${m.species}'s item ${m.item} is banned`;
    }
    for (const mv of m.moves) {
      if (mv && isMoveBanned(mv)) return `${m.species}'s move ${mv} is banned`;
    }
  }
  return null;
}
