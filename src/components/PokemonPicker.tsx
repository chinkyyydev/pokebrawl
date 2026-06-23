import { useMemo, useState } from 'react';
import { allSpecies, type SpeciesLite } from '../data/pokedex';
import { monSprite } from '../data/sprites';
import { isSpeciesBanned } from '../data/bans';

const TYPE_NULL = '—';

export function PokemonPicker({
  onPick,
  exclude,
  pool,
  searchable = true,
  shinySpecies,
}: {
  onPick: (s: SpeciesLite) => void;
  exclude?: Set<string>; // lowercased species names already on the team
  pool?: SpeciesLite[]; // restrict choices to this set (default: all 1025)
  searchable?: boolean; // hide the search box for small fixed pools (drafts)
  shinySpecies?: Set<string>; // lowercased species names the player owns shiny
}) {
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const base = pool ?? allSpecies();
    const all = exclude?.size
      ? base.filter((s) => !exclude.has(s.name.toLowerCase()))
      : base;
    const term = q.trim().toLowerCase();
    if (!term) return all;
    return all.filter(
      (s) => s.name.toLowerCase().includes(term) || String(s.num) === term,
    );
  }, [q, exclude, pool]);

  return (
    <div className="picker">
      {searchable && (
        <input
          className="search"
          placeholder="Search all 1025 Pokémon by name or #…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
      )}
      <div className="picker-list">
        {list.map((s) => {
          const banned = isSpeciesBanned(s.name);
          const shiny = shinySpecies?.has(s.name.toLowerCase());
          return (
            <button
              key={s.id}
              className={`picker-row ${banned ? 'banned' : ''}`}
              disabled={banned}
              onClick={() => onPick(s)}
            >
              <img
                src={monSprite(s.name, shiny)}
                alt=""
                className="pixel picker-sprite"
                loading="lazy"
              />
              <span className="dex-num">#{String(s.num).padStart(4, '0')}</span>
              <span className="dex-name">
                {s.name}
                {shiny && <span className="shiny-tag">✨</span>}
                {banned && <span className="ban-tag">BANNED</span>}
              </span>
              <span className="dex-types">
                {s.types.map((t) => (
                  <span key={t} className={`type type-${t.toLowerCase()}`}>
                    {t}
                  </span>
                )) || TYPE_NULL}
              </span>
            </button>
          );
        })}
        {!list.length && <div className="muted">No matches.</div>}
      </div>
    </div>
  );
}
