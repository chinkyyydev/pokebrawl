import type { PokemonSet } from '@pkmn/sim';

export interface TeamMember {
  species: string; // display name, e.g. "Garchomp"
  ability: string;
  item: string;
  moves: string[]; // up to 4 move display names
  nature: string;
  shiny?: boolean; // cosmetic only — rolled once when the Pokémon is acquired
}

// Every Pokémon is capped at max level for complete fairness.
export const MAX_LEVEL = 100;

export function emptyMember(
  species: string,
  ability = '',
  moves: string[] = [],
  shiny = false,
): TeamMember {
  return { species, ability, item: '', moves, nature: 'Hardy', shiny };
}

/** Convert our editable team member into the PokemonSet shape the sim expects. */
export function toPokemonSet(m: TeamMember): PokemonSet {
  return {
    name: m.species,
    species: m.species,
    item: m.item,
    ability: m.ability,
    moves: m.moves.filter(Boolean),
    nature: m.nature,
    gender: '',
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    level: MAX_LEVEL,
    shiny: m.shiny,
  };
}

export type Team = (TeamMember | null)[]; // length 6
