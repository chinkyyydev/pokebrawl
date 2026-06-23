import { useState } from 'react';
import type { SpeciesLite } from '../data/pokedex';
import { sampleSpecies, randomMember } from '../game/randomTeam';
import type { TeamMember } from '../types';
import { PokemonPicker } from './PokemonPicker';
import { DialogBox } from './DialogBox';

/** One-time free draft for new trainers: pick 1 of 3 random Pokémon, then the
 * other 2 starting team slots are auto-filled by random picks. Every member
 * comes back fully battle-ready (ability + 4 moves already set), not just a
 * bare species — otherwise the team would show "incomplete" until the
 * player manually opened each one in TeamBuilder. */
export function StarterDraft({
  onDone,
}: {
  onDone: (members: TeamMember[]) => void; // [chosen, computerPick1, computerPick2]
}) {
  const [options] = useState<SpeciesLite[]>(() => sampleSpecies(3));
  const [building, setBuilding] = useState(false);

  async function choose(s: SpeciesLite) {
    setBuilding(true);
    const rest = sampleSpecies(2, [s.name]);
    const members = await Promise.all([s, ...rest].map(randomMember));
    onDone(members);
  }

  return (
    <div className="scene starter-draft-scene">
      <DialogBox speaker="PROF. OAK">
        Welcome, new trainer! Pick your first partner Pokémon to keep for
        good — the other two will join your team at random, on a 24-hour
        loan. I'll swap each one out for a new random Pokémon once its loan
        runs out.
      </DialogBox>
      {building ? (
        <div className="loading">Sending out your first partner…</div>
      ) : (
        <PokemonPicker onPick={choose} pool={options} searchable={false} />
      )}
    </div>
  );
}
