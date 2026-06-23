// Thin wrappers over @pkmn/dex — Pokémon Showdown's full dataset.
// All species/move/ability/learnset data comes straight from here, so it is
// as accurate as Showdown itself (all 1025 Pokémon, real types/effects).
import { Dex, toID } from '@pkmn/dex';
import { COMPETITIVE_ITEM_IDS } from './items';

export interface SpeciesLite {
  id: string;
  name: string;
  num: number;
  types: string[];
  baseStats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  abilities: string[];
}

export interface MoveLite {
  id: string;
  name: string;
  type: string;
  category: 'Physical' | 'Special' | 'Status';
  basePower: number;
  accuracy: number | true;
  pp: number;
  shortDesc: string;
}

const NATIONAL_DEX_MAX = 1025;

let _speciesCache: SpeciesLite[] | null = null;

/** Every base-forme Pokémon in the National Dex (1..1025), sorted by number. */
export function allSpecies(): SpeciesLite[] {
  if (_speciesCache) return _speciesCache;
  const out: SpeciesLite[] = [];
  for (const s of Dex.species.all()) {
    if (s.num < 1 || s.num > NATIONAL_DEX_MAX) continue;
    // Base forme only, to land at ~1025 entries. Alternate formes can be
    // surfaced later via a "show formes" toggle.
    if (s.forme && s.baseSpecies !== s.name) continue;
    out.push(toLite(s));
  }
  out.sort((a, b) => a.num - b.num || a.name.localeCompare(b.name));
  _speciesCache = out;
  return out;
}

export function getSpecies(name: string): SpeciesLite | null {
  const s = Dex.species.get(name);
  return s?.exists ? toLite(s) : null;
}

// Gen 1-4 National Dex cutoff (Bulbasaur #1 through Arceus #493).
const GEN_1_TO_4_MAX_DEX = 493;
const COMPETITIVE_POOL_SIZE = 400;

// Smogon singles tier, best to worst. @pkmn/dex bundles each species' current
// tier directly (s.tier); anything not listed here (CAP, Illegal/Unreleased,
// or simply untiered) sorts last, after NFE.
const TIER_RANK: Record<string, number> = {
  AG: 0,
  Uber: 1,
  '(Uber)': 1,
  OU: 2,
  '(OU)': 2,
  UUBL: 3,
  UU: 4,
  RUBL: 5,
  RU: 6,
  NUBL: 7,
  NU: 8,
  '(NU)': 8,
  PUBL: 9,
  PU: 10,
  '(PU)': 10,
  ZUBL: 11,
  ZU: 12,
  LC: 13,
  NFE: 14,
};
const UNTIERED_RANK = 15;

let _competitiveCache: SpeciesLite[] | null = null;

/**
 * The ~400 most competitively relevant Pokémon from Gens 1-4 (National Dex
 * #1-493), ranked by their bundled Smogon singles tier (Uber down through
 * PU/ZU, with LC/NFE/untiered species filling out the rest). This is the
 * only pool new Pokémon are drawn from for now (see `sampleSpecies` in
 * src/game/randomTeam.ts) — `allSpecies()` above stays the full dex for
 * general lookups (e.g. resolving a species a player already owns).
 */
export function competitiveSpecies(): SpeciesLite[] {
  if (_competitiveCache) return _competitiveCache;
  const bst = (s: ReturnType<typeof Dex.species.get>) =>
    Object.values(s.baseStats).reduce((a, b) => a + b, 0);
  const ranked = Dex.species
    .all()
    .filter((s) => s.num >= 1 && s.num <= GEN_1_TO_4_MAX_DEX && !(s.forme && s.baseSpecies !== s.name))
    .map((s) => ({ s, rank: TIER_RANK[s.tier ?? ''] ?? UNTIERED_RANK }))
    // Within the same tier (most consequentially the untiered/NFE catch-all),
    // higher base stat total is a better proxy for viability than dex order.
    .sort((a, b) => a.rank - b.rank || bst(b.s) - bst(a.s) || a.s.num - b.s.num);
  const top = ranked.slice(0, COMPETITIVE_POOL_SIZE).map((x) => toLite(x.s));
  top.sort((a, b) => a.num - b.num);
  _competitiveCache = top;
  return top;
}

function toLite(s: ReturnType<typeof Dex.species.get>): SpeciesLite {
  const abilities = Object.values(s.abilities).filter(Boolean) as string[];
  return {
    id: s.id,
    name: s.name,
    num: s.num,
    types: s.types.slice(),
    baseStats: { ...s.baseStats },
    abilities: Array.from(new Set(abilities)),
  };
}

export function getMove(name: string): MoveLite | null {
  const m = Dex.moves.get(name);
  if (!m?.exists) return null;
  return {
    id: m.id,
    name: m.name,
    type: m.type,
    category: m.category as MoveLite['category'],
    basePower: m.basePower,
    accuracy: m.accuracy === true ? true : (m.accuracy as number),
    pp: m.pp,
    shortDesc: m.shortDesc || m.desc || '',
  };
}

/**
 * Every move a species can legally learn, including moves inherited from its
 * pre-evolutions and base species. Source generation is not filtered, so this
 * is a permissive "ever learnable" set — good enough for team building; tighten
 * later if you want strict format legality.
 */
export async function legalMoves(speciesName: string): Promise<MoveLite[]> {
  const ids = new Set<string>();
  const visited = new Set<string>();

  async function walk(name: string) {
    const id = toID(name);
    if (!id || visited.has(id)) return;
    visited.add(id);

    const data = await Dex.learnsets.get(id);
    if (data?.learnset) {
      for (const moveId of Object.keys(data.learnset)) ids.add(moveId);
    }

    const sp = Dex.species.get(id);
    if (!sp?.exists) return;
    if (sp.prevo) await walk(sp.prevo);
    if (sp.baseSpecies && sp.baseSpecies !== sp.name) await walk(sp.baseSpecies);
    if (sp.changesFrom) await walk(sp.changesFrom as string);
  }

  await walk(speciesName);

  const moves: MoveLite[] = [];
  for (const id of ids) {
    const m = getMove(id);
    if (m) moves.push(m);
  }
  moves.sort((a, b) => a.name.localeCompare(b.name));
  return moves;
}

// ---------- Abilities ----------

export interface AbilityLite {
  id: string;
  name: string;
  shortDesc: string;
}

export function getAbility(name: string): AbilityLite | null {
  const a = Dex.abilities.get(name);
  if (!a?.exists) return null;
  return { id: a.id, name: a.name, shortDesc: a.shortDesc || a.desc || '' };
}

/** A species' abilities, each with its description. */
export function speciesAbilities(speciesName: string): AbilityLite[] {
  const sp = getSpecies(speciesName);
  if (!sp) return [];
  const out: AbilityLite[] = [];
  for (const name of sp.abilities) {
    const a = getAbility(name);
    if (a) out.push(a);
  }
  return out;
}

// ---------- Items ----------

export interface ItemLite {
  id: string;
  name: string;
  shortDesc: string;
}

function toItemLite(it: ReturnType<typeof Dex.items.get>): ItemLite {
  return { id: it.id, name: it.name, shortDesc: it.shortDesc || it.desc || '' };
}

/** Does this species-locked item belong to the given species (incl. its formes)? */
function itemUserMatches(users: string[], sp: ReturnType<typeof Dex.species.get>): boolean {
  for (const u of users) {
    const us = Dex.species.get(u);
    if (!us?.exists) {
      if (toID(u) === sp.id) return true;
      continue;
    }
    if (us.id === sp.id) return true;
    if (toID(us.baseSpecies) === sp.id || toID(us.baseSpecies) === toID(sp.baseSpecies)) {
      return true;
    }
  }
  return false;
}

const _itemsCache = new Map<string, ItemLite[]>();

/**
 * Selectable held items for a species: the curated competitive pool (see
 * `COMPETITIVE_ITEM_IDS`) plus any species-exclusive items (`itemUser`) that
 * belong to this Pokémon. Pass no species to get just the general pool.
 */
export function allItems(speciesName?: string): ItemLite[] {
  const key = speciesName ? toID(speciesName) : '';
  const cached = _itemsCache.get(key);
  if (cached) return cached;

  const sp = speciesName ? Dex.species.get(speciesName) : null;
  const out: ItemLite[] = [];
  for (const it of Dex.items.all()) {
    if (it.isNonstandard) continue;
    if (it.itemUser && it.itemUser.length) {
      // Species-exclusive item — only show it for its intended Pokémon.
      if (sp?.exists && itemUserMatches(it.itemUser, sp)) out.push(toItemLite(it));
      continue;
    }
    if (COMPETITIVE_ITEM_IDS.has(it.id)) out.push(toItemLite(it));
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  _itemsCache.set(key, out);
  return out;
}

export function getItem(name: string): ItemLite | null {
  const it = Dex.items.get(name);
  if (!it?.exists) return null;
  return toItemLite(it);
}

// ---------- Natures ----------

const STAT_NAME: Record<string, string> = {
  hp: 'HP',
  atk: 'Attack',
  def: 'Defense',
  spa: 'Sp. Atk',
  spd: 'Sp. Def',
  spe: 'Speed',
};

export interface NatureLite {
  id: string;
  name: string;
  desc: string; // e.g. "+10% Attack, −10% Sp. Atk" or neutral
}

// Every nature raises one stat by 10% and lowers another by 10% (neutral natures
// do neither). We spell out both the amount and which stat is affected.
function natureDesc(plus?: string, minus?: string): string {
  if (!plus || !minus || plus === minus) return 'No stat change (neutral)';
  return `+10% ${STAT_NAME[plus] ?? plus}, −10% ${STAT_NAME[minus] ?? minus}`;
}

let _naturesCache: NatureLite[] | null = null;

export function allNatures(): NatureLite[] {
  if (_naturesCache) return _naturesCache;
  const out: NatureLite[] = [];
  for (const n of Dex.natures.all()) {
    out.push({ id: n.id, name: n.name, desc: natureDesc(n.plus, n.minus) });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  _naturesCache = out;
  return out;
}
