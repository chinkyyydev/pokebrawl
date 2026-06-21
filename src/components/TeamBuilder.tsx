import { useEffect, useState } from 'react';
import {
  allItems,
  allNatures,
  legalMoves,
  speciesAbilities,
  type MoveLite,
  type SpeciesLite,
} from '../data/pokedex';
import { emptyMember, type Team, type TeamMember } from '../types';
import { teamProblem } from '../state/storage';
import { monSprite } from '../data/sprites';
import { PokemonPicker } from './PokemonPicker';
import { MovePicker } from './MovePicker';

export function TeamBuilder({
  team,
  teamName,
  onChange,
  onRename,
  onDone,
}: {
  team: Team;
  teamName: string;
  onChange: (team: Team) => void;
  onRename: (name: string) => void;
  onDone: () => void;
}) {
  const [slot, setSlot] = useState(0);
  const [picking, setPicking] = useState(team.every((m) => !m)); // open picker if empty
  const [moveCache, setMoveCache] = useState<Record<string, MoveLite[]>>({});
  const [loadingMoves, setLoadingMoves] = useState(false);

  const member = team[slot];

  useEffect(() => {
    if (!member || moveCache[member.species]) return;
    let cancelled = false;
    setLoadingMoves(true);
    legalMoves(member.species).then((moves) => {
      if (cancelled) return;
      setMoveCache((c) => ({ ...c, [member.species]: moves }));
      setLoadingMoves(false);
    });
    return () => {
      cancelled = true;
    };
  }, [member?.species]);

  function update(next: TeamMember) {
    const copy = team.slice();
    copy[slot] = next;
    onChange(copy);
  }

  function pickSpecies(s: SpeciesLite) {
    const copy = team.slice();
    copy[slot] = emptyMember(s.name, s.abilities[0] ?? '', []);
    onChange(copy);
    setPicking(false);
  }

  function setMove(i: number, name: string) {
    if (!member) return;
    const moves = member.moves.slice();
    moves[i] = name;
    update({ ...member, moves });
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
  const speciesMoves = member ? moveCache[member.species] ?? [] : [];
  const abilityList = member ? speciesAbilities(member.species) : [];
  const natures = allNatures();
  const items = member ? allItems(member.species) : [];
  const currentAbility = abilityList.find((a) => a.name === member?.ability);
  const currentNature = natures.find((n) => n.name === member?.nature);
  const currentItem = items.find((it) => it.name === member?.item);

  return (
    <div className="builder">
      <div className="builder-slots">
        {team.map((m, i) => (
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
              <img src={monSprite(m.species)} alt={m.species} className="pixel slot-sprite" />
            ) : (
              <span className="slot-sprite empty-ball">·</span>
            )}
            <span className="slot-name">{m ? m.species : 'Empty'}</span>
            {m && (
              <span className="slot-moves">
                {m.moves.filter(Boolean).length}/4 moves
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="builder-editor">
        {picking || !member ? (
          <PokemonPicker onPick={pickSpecies} exclude={usedSpecies} />
        ) : (
          <div className="editor">
            <div className="editor-head">
              <h2>{member.species}</h2>
              <div className="editor-actions">
                <button onClick={() => setPicking(true)}>Change Pokémon</button>
                <button className="danger" onClick={clearSlot}>
                  Remove
                </button>
              </div>
            </div>

            <div className="editor-grid">
              <label>
                Ability
                <select
                  value={member.ability}
                  onChange={(e) => update({ ...member, ability: e.target.value })}
                >
                  {abilityList.map((a) => (
                    <option key={a.id} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                </select>
                {currentAbility && (
                  <p className="desc">{currentAbility.shortDesc || 'No description available.'}</p>
                )}
              </label>

              <label>
                Nature
                <select
                  value={member.nature}
                  onChange={(e) => update({ ...member, nature: e.target.value })}
                >
                  {natures.map((n) => (
                    <option key={n.id} value={n.name}>
                      {n.name} — {n.desc}
                    </option>
                  ))}
                </select>
                {currentNature && <p className="desc">{currentNature.desc}</p>}
              </label>

              <label className="span-2">
                Item (optional)
                <select
                  value={member.item}
                  onChange={(e) => update({ ...member, item: e.target.value })}
                >
                  <option value="">— none —</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.name}>
                      {it.name}
                    </option>
                  ))}
                </select>
                {currentItem ? (
                  <p className="desc">{currentItem.shortDesc || 'No description available.'}</p>
                ) : (
                  <p className="desc">No item held. Capped at Lv. 100 — same for every Pokémon.</p>
                )}
              </label>
            </div>

            <h3>
              Moves {loadingMoves && <span className="muted">(loading legal moves…)</span>}
            </h3>
            <div className="move-grid">
              {[0, 1, 2, 3].map((i) => (
                <MovePicker
                  key={i}
                  moves={speciesMoves}
                  value={member.moves[i] ?? ''}
                  onChange={(name) => setMove(i, name)}
                  disabled={loadingMoves}
                  taken={new Set(member.moves.filter((mv, j): mv is string => !!mv && j !== i))}
                />
              ))}
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
