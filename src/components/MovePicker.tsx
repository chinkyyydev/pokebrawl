import type { MoveLite } from '../data/pokedex';

export function MovePicker({
  moves,
  value,
  onChange,
  disabled,
  taken,
}: {
  moves: MoveLite[];
  value: string;
  onChange: (name: string) => void;
  disabled?: boolean;
  taken?: Set<string>; // moves already chosen in this Pokémon's other slots
}) {
  const selected = moves.find((m) => m.name === value);

  return (
    <div className="move-picker">
      <select
        className="move-select"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— empty —</option>
        {moves.map((m) => {
          // A move already chosen in another slot is shadowed out + unselectable
          // (but the move currently in THIS slot stays selectable).
          const used = !!taken?.has(m.name) && m.name !== value;
          return (
            <option key={m.id} value={m.name} disabled={used}>
              {m.name} · {m.type} ·{' '}
              {m.category === 'Status' ? 'Status' : `${m.basePower || '—'} BP`}
              {used ? ' — in use' : ''}
            </option>
          );
        })}
      </select>
      {selected && (
        <p className="desc">
          <span className="desc-meta">
            {selected.type} · {selected.category} ·{' '}
            {selected.category === 'Status' ? '—' : `${selected.basePower || '—'} BP`} ·{' '}
            Acc {selected.accuracy === true ? '∞' : `${selected.accuracy}%`} · {selected.pp} PP
          </span>
          {selected.shortDesc || 'No description available.'}
        </p>
      )}
    </div>
  );
}
