import { useMemo, useState } from 'react';
import { allSpecies, type SpeciesLite } from '../data/pokedex';
import { monSprite } from '../data/sprites';
import { isSpeciesBanned } from '../data/bans';

const TYPE_NULL = '—';

export function PokemonPicker({
  onPick,
  exclude,
}: {
  onPick: (s: SpeciesLite) => void;
  exclude?: Set<string>; // lowercased species names already on the team
}) {
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const all = exclude?.size
      ? allSpecies().filter((s) => !exclude.has(s.name.toLowerCase()))
      : allSpecies();
    const term = q.trim().toLowerCase();
    if (!term) return all; // full National Dex (all 1025)
    return all.filter(
      (s) => s.name.toLowerCase().includes(term) || String(s.num) === term,
    );
  }, [q, exclude]);

  return (
    <div className="picker">
      <input
        className="search"
        placeholder="Search all 1025 Pokémon by name or #…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />
      <div className="picker-list">
        {list.map((s) => {
          const banned = isSpeciesBanned(s.name);
          return (
            <button
              key={s.id}
              className={`picker-row ${banned ? 'banned' : ''}`}
              disabled={banned}
              onClick={() => onPick(s)}
            >
              <img src={monSprite(s.name)} alt="" className="pixel picker-sprite" loading="lazy" />
              <span className="dex-num">#{String(s.num).padStart(4, '0')}</span>
              <span className="dex-name">
                {s.name}
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
