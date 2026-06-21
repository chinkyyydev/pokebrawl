import { allSpecies, legalMoves } from '../data/pokedex';
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

/** Build a random legal-ish CPU team of `size` Pokémon, each with 4 moves. */
export async function randomTeam(size = PARTY_SIZE): Promise<TeamMember[]> {
  const pool = sample(allSpecies(), size);
  const team: TeamMember[] = [];

  for (const sp of pool) {
    const moves = await legalMoves(sp.name);
    // Prefer damaging moves so the CPU actually does something.
    const damaging = moves.filter((m) => m.category !== 'Status');
    const chosen = sample(damaging.length >= 4 ? damaging : moves, 4).map((m) => m.name);
    const ability = sp.abilities[0] ?? '';
    team.push(emptyMember(sp.name, ability, chosen));
  }
  return team;
}
