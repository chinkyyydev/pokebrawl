import { competitiveSpecies, legalMoves, type SpeciesLite } from '../data/pokedex';
import { emptyMember, type TeamMember } from '../types';
import { PARTY_SIZE } from '../state/storage';

function sample<T>(arr: T[], n: number): T[] {
  const copy = arr.slice();
  const out: T[] = [];
  while (out.length < n && copy.length) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

/** Pick `n` random species from the current competitive pool (Gens 1-4 top
 * ~400, see `competitiveSpecies()`), optionally excluding some (by display
 * name, case-insensitive) — used by the starter draft, level-up drops, and
 * the buy-with-coin screen. */
export function sampleSpecies(n: number, exclude: string[] = []): SpeciesLite[] {
  const excluded = new Set(exclude.map((s) => s.toLowerCase()));
  const pool = excluded.size
    ? competitiveSpecies().filter((s) => !excluded.has(s.name.toLowerCase()))
    : competitiveSpecies();
  return sample(pool, n);
}

/** Build a full, battle-ready TeamMember for one species: a default ability
 * and 4 legal moves (preferring damaging ones). Used wherever the system —
 * not the player — hands someone a Pokémon: CPU teams, the starter draft,
 * rental rotation. */
export async function randomMember(sp: SpeciesLite): Promise<TeamMember> {
  const moves = await legalMoves(sp.name);
  // Prefer damaging moves so the Pokémon actually does something.
  const damaging = moves.filter((m) => m.category !== 'Status');
  const chosen = sample(damaging.length >= 4 ? damaging : moves, 4).map((m) => m.name);
  const ability = sp.abilities[0] ?? '';
  return emptyMember(sp.name, ability, chosen);
}

/** Build a random legal-ish CPU team of `size` Pokémon, each with 4 moves. */
export async function randomTeam(size = PARTY_SIZE): Promise<TeamMember[]> {
  const pool = sample(competitiveSpecies(), size);
  return Promise.all(pool.map(randomMember));
}
