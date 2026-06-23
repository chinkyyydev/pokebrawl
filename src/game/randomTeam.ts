import { allItems, allNatures, competitiveSpecies, legalMoves, type SpeciesLite } from '../data/pokedex';
import { isAbilityBanned, isItemBanned, isMoveBanned } from '../data/bans';
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

function pick<T>(arr: T[]): T | undefined {
  return arr[Math.floor(Math.random() * arr.length)];
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

/**
 * Build a full, permanent TeamMember for one species: a random ability,
 * nature, held item (or none), and 4 moves — every field rolled fairly
 * (uniform odds among the species' own legal options) and fixed for good the
 * moment the Pokémon is acquired. Never rolls anything on the ban list, so
 * the result is always a legal, battle-ready Pokémon.
 *
 * Used wherever a Pokémon is handed out: CPU teams, the starter draft,
 * level-up drops, the shop, and rental rotation.
 */
export async function randomMember(sp: SpeciesLite): Promise<TeamMember> {
  const legalPool = (await legalMoves(sp.name)).filter((m) => !isMoveBanned(m.name));
  const damaging = legalPool.filter((m) => m.category !== 'Status');

  // Guarantee 1-2 damaging moves so the moveset is actually usable, then fill
  // the rest of the 4 slots fairly at random from whatever's left.
  const guaranteedCount = Math.min(damaging.length, pick([1, 2]) ?? 1);
  const guaranteed = sample(damaging, guaranteedCount);
  const guaranteedIds = new Set(guaranteed.map((m) => m.id));
  const fill = sample(
    legalPool.filter((m) => !guaranteedIds.has(m.id)),
    Math.max(0, 4 - guaranteed.length),
  );
  const moves = [...guaranteed, ...fill].map((m) => m.name);

  const legalAbilities = sp.abilities.filter((a) => !isAbilityBanned(a));
  const ability = pick(legalAbilities.length ? legalAbilities : sp.abilities) ?? '';

  const nature = pick(allNatures())?.name ?? 'Hardy';

  // "No item" is just as likely as any single legal item — fair odds, not a
  // guarantee either way.
  const legalItems = allItems(sp.name).filter((it) => !isItemBanned(it.name));
  const item = pick(['', ...legalItems.map((it) => it.name)]) ?? '';

  return emptyMember(sp.name, ability, moves, false, nature, item);
}

/** Build a random legal-ish CPU team of `size` Pokémon, each with 4 moves. */
export async function randomTeam(size = PARTY_SIZE): Promise<TeamMember[]> {
  const pool = sample(competitiveSpecies(), size);
  return Promise.all(pool.map(randomMember));
}
