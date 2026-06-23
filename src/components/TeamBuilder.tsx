import { useEffect, useMemo, useState } from 'react';
import {
  allItems,
  allNatures,
  allSpecies,
  legalMoves,
  speciesAbilities,
  type MoveLite,
  type SpeciesLite,
} from '../data/pokedex';
import { emptyMember, type Team, type TeamMember } from '../types';
import { teamProblem, type CollectionEntry, type Rental } from '../state/storage';
import { monSprite } from '../data/sprites';
import { PokemonPicker } from './PokemonPicker';
import { MovePicker } from './MovePicker';
import { isAbilityBanned, isItemBanned } from '../data/bans';

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
  collection: CollectionEntry[]; // owned species — the only ones pickable here
  rentals: Rental[]; // currently-on-loan species (subset of collection)
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
    const shiny = shinyMap.get(s.name.toLowerCase()) ?? false;
    const copy = team.slice();
    copy[slot] = emptyMember(s.name, s.abilities[0] ?? '', [], shiny);
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
  const shinyMap = useMemo(
    () => new Map(collection.map((e) => [e.species.toLowerCase(), e.shiny])),
    [collection],
  );
  const shinySpecies = useMemo(
    () => new Set(collection.filter((e) => e.shiny).map((e) => e.species.toLowerCase())),
    [collection],
  );
  const ownedPool = useMemo(() => {
    const owned = new Set(collection.map((e) => e.species.toLowerCase()));
    return allSpecies().filter((s) => owned.has(s.name.toLowerCase()));
  }, [collection]);
  const memberRental = member
    ? rentals.find((r) => r.species.toLowerCase() === member.species.toLowerCase())
    : undefined;
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
          />
        ) : (
          <div className="editor">
            <div className="editor-head">
              <h2>
                {member.species}
                {member.shiny && <span className="shiny-tag">✨ Shiny</span>}
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

            <div className="editor-grid">
              <label>
                Ability
                <select
                  value={member.ability}
                  onChange={(e) => update({ ...member, ability: e.target.value })}
                >
                  {abilityList.map((a) => {
                    const banned = isAbilityBanned(a.name);
                    return (
                      <option key={a.id} value={a.name} disabled={banned}>
                        {a.name}
                        {banned ? ' — BANNED' : ''}
                      </option>
                    );
                  })}
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
                  {items.map((it) => {
                    const banned = isItemBanned(it.name);
                    return (
                      <option key={it.id} value={it.name} disabled={banned}>
                        {it.name}
                        {banned ? ' — BANNED' : ''}
                      </option>
                    );
                  })}
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
