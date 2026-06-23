import { useMemo, useState } from 'react';
import { allNatures, allSpecies, getAbility, getItem, getMove, type SpeciesLite } from '../data/pokedex';
import { type Team, type TeamMember } from '../types';
import { teamProblem, type Rental } from '../state/storage';
import { monSprite } from '../data/sprites';
import { PokemonPicker } from './PokemonPicker';
import { isLegendary } from '../data/bans';

function hoursLeft(expiresAt: number): number {
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 3_600_000));
}

export function TeamBuilder({
  team,
  teamName,
  collection,
  rentals,
  onChange,
  onRename,
  onDone,
}: {
  team: Team;
  teamName: string;
  collection: TeamMember[]; // every Pokémon ever acquired — the only ones pickable here
  rentals: Rental[]; // currently-on-loan species (subset of collection)
  onChange: (team: Team) => void;
  onRename: (name: string) => void;
  onDone: () => void;
}) {
  const [slot, setSlot] = useState(0);
  const [picking, setPicking] = useState(team.every((m) => !m)); // open picker if empty

  const member = team[slot];

  // Ability/nature/item/moves are rolled once and fixed forever the moment a
  // Pokémon is acquired (see randomMember()) — picking a species here just
  // copies that already-complete record into the slot, nothing to generate.
  function pickSpecies(s: SpeciesLite) {
    const owned = collection.find((m) => m.species.toLowerCase() === s.name.toLowerCase());
    if (!owned) return;
    const copy = team.slice();
    copy[slot] = { ...owned };
    onChange(copy);
    setPicking(false);
  }

  function clearSlot() {
    const copy = team.slice();
    copy[slot] = null;
    onChange(copy);
    setPicking(true);
  }

  const filled = team.filter((m): m is TeamMember => !!m);
  // Species already used in OTHER slots (so the picker can't add a duplicate).
  const usedSpecies = new Set(
    team
      .filter((m, i): m is TeamMember => !!m && i !== slot)
      .map((m) => m.species.toLowerCase()),
  );
  const problem = teamProblem({ name: teamName, members: team });
  const shinySpecies = useMemo(
    () => new Set(collection.filter((m) => m.shiny).map((m) => m.species.toLowerCase())),
    [collection],
  );
  const ownedPool = useMemo(() => {
    const owned = new Set(collection.map((m) => m.species.toLowerCase()));
    return allSpecies().filter((s) => owned.has(s.name.toLowerCase()));
  }, [collection]);
  // Another slot already holds the team's one allowed Legendary.
  const legendaryLimitReached = team.some(
    (m, i) => !!m && i !== slot && isLegendary(m.species),
  );
  const memberRental = member
    ? rentals.find((r) => r.species.toLowerCase() === member.species.toLowerCase())
    : undefined;
  const abilityInfo = member ? getAbility(member.ability) : null;
  const natureInfo = member ? allNatures().find((n) => n.name === member.nature) : null;
  const itemInfo = member?.item ? getItem(member.item) : null;

  return (
    <div className="builder">
      <div className="builder-slots">
        {team.map((m, i) => {
          const rental = m
            ? rentals.find((r) => r.species.toLowerCase() === m.species.toLowerCase())
            : undefined;
          return (
            <button
              key={i}
              className={`slot ${i === slot ? 'active' : ''} ${m ? 'filled' : ''}`}
              onClick={() => {
                setSlot(i);
                setPicking(!team[i]);
              }}
            >
              <span className="slot-index">{i + 1}</span>
              {m ? (
                <img
                  src={monSprite(m.species, m.shiny)}
                  alt={m.species}
                  className="pixel slot-sprite"
                />
              ) : (
                <span className="slot-sprite empty-ball">·</span>
              )}
              <span className="slot-name">
                {m ? m.species : 'Empty'}
                {m?.shiny && <span className="shiny-tag">✨</span>}
                {m && isLegendary(m.species) && <span className="legendary-tag">★</span>}
              </span>
              {m && (
                <span className="slot-moves">
                  {m.moves.filter(Boolean).length}/4 moves
                </span>
              )}
              {rental && (
                <span className="slot-rented">🕒 Rented · {hoursLeft(rental.expiresAt)}h left</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="builder-editor">
        {picking || !member ? (
          <PokemonPicker
            onPick={pickSpecies}
            exclude={usedSpecies}
            pool={ownedPool}
            shinySpecies={shinySpecies}
            legendaryLimitReached={legendaryLimitReached}
          />
        ) : (
          <div className="editor">
            <div className="editor-head">
              <h2>
                {member.species}
                {member.shiny && <span className="shiny-tag">✨ Shiny</span>}
                {isLegendary(member.species) && (
                  <span className="legendary-tag">★ Legendary</span>
                )}
              </h2>
              <div className="editor-actions">
                <button onClick={() => setPicking(true)}>Change Pokémon</button>
                <button className="danger" onClick={clearSlot}>
                  Remove
                </button>
              </div>
            </div>
            {memberRental && (
              <p className="desc rented-notice">
                🕒 Rented — auto-swapped for a new random Pokémon in{' '}
                {hoursLeft(memberRental.expiresAt)}h.
              </p>
            )}
            <p className="desc muted">
              Ability, nature, item, and moves are rolled once when a Pokémon is
              caught and locked in for good — they can't be changed.
            </p>

            <div className="editor-grid">
              <div className="fixed-field">
                <span className="fixed-label">Ability</span>
                <span className="fixed-value">{member.ability || '—'}</span>
                {abilityInfo && <p className="desc">{abilityInfo.shortDesc}</p>}
              </div>

              <div className="fixed-field">
                <span className="fixed-label">Nature</span>
                <span className="fixed-value">{member.nature}</span>
                {natureInfo && <p className="desc">{natureInfo.desc}</p>}
              </div>

              <div className="fixed-field span-2">
                <span className="fixed-label">Item</span>
                <span className="fixed-value">{member.item || 'None held'}</span>
                <p className="desc">
                  {itemInfo?.shortDesc || (member.item ? 'No description available.' : 'Capped at Lv. 100 — same for every Pokémon.')}
                </p>
              </div>
            </div>

            <h3>Moves</h3>
            <div className="move-grid">
              {member.moves.map((name, i) => {
                const move = getMove(name);
                return (
                  <div key={i} className="fixed-field move-display">
                    <span className="fixed-value">{name}</span>
                    {move && (
                      <p className="desc">
                        <span className="desc-meta">
                          {move.type} · {move.category} ·{' '}
                          {move.category === 'Status' ? '—' : `${move.basePower || '—'} BP`} ·{' '}
                          Acc {move.accuracy === true ? '∞' : `${move.accuracy}%`} · {move.pp} PP
                        </span>
                        {move.shortDesc || 'No description available.'}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="builder-footer">
        <label className="team-name-field">
          TEAM
          <input
            className="retro-input team-name-input"
            value={teamName}
            maxLength={16}
            onChange={(e) => onRename(e.target.value)}
          />
        </label>
        <span className={problem ? 'team-status bad' : 'team-status ok'}>
          {filled.length}/3 · {problem ? `⚠ ${problem}` : '✓ Battle-ready'}
        </span>
        <button className="press-start" onClick={onDone}>
          SAVE &amp; EXIT ▶
        </button>
      </div>
    </div>
  );
}
