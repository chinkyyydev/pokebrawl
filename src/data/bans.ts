// Competitive ban list, based on Smogon's standard singles rules — except for
// species: every Pokémon is selectable, with Legendaries capped at 1 per team
// (see teamBanViolation) instead of being unselectable like Smogon's actual
// Uber/AG bans.
//
// Sources: Smogon clauses (OHKO, Evasion) + standard OU banlist.
import { Dex, toID } from '@pkmn/dex';

// --- Pokémon: no species is outright banned — every Pokémon is selectable.
// Legendaries (Mythical / Restricted Legendary / Sub-Legendary, per @pkmn/dex's
// own classification) are still powerful enough to warrant a limit, so
// they're capped at 1 per team instead (see teamBanViolation below) rather
// than being unselectable.
const LEGENDARY_TAGS = new Set(['Mythical', 'Restricted Legendary', 'Sub-Legendary']);
export function isLegendary(name: string): boolean {
  const tags = Dex.species.get(name).tags ?? [];
  return tags.some((t) => LEGENDARY_TAGS.has(t));
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
  const legendaries = members.filter((m) => isLegendary(m.species));
  if (legendaries.length > 1) return 'Only 1 Legendary allowed per team';
  for (const m of members) {
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
