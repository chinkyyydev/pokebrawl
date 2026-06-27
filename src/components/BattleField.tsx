import { useEffect, useState } from 'react';
import type { ActiveView, RequestView } from '../game/battle';
import { monSprite, monSpriteAnim } from '../data/sprites';

// Transient battle animation on a sprite: attack lunge or hit shake.
export type Fx = 'atk' | 'hit' | undefined;

/** One side's panel: name, team dots, animated sprite, HP bar. */
export function Combatant({
  who,
  mon,
  party,
  foe,
  anim,
  shiny,
}: {
  who: string;
  mon: ActiveView | null;
  party: { fainted: boolean }[];
  foe?: boolean;
  anim?: Fx;
  shiny?: boolean;
}) {
  return (
    <div className={`combatant ${foe ? 'foe' : 'ally'} ${mon?.fainted ? 'fainted' : ''}`}>
      <div className="combatant-head">
        <span className="who">{who}</span>
        <span className="team-dots">
          {party.map((p, i) => (
            <span key={i} className={`dot ${p.fainted ? 'fainted' : ''}`} />
          ))}
        </span>
      </div>
      {mon ? (
        <>
          <MonImg species={mon.species} foe={!!foe} anim={anim} shiny={shiny} />
          <div className="mon-name">
            {mon.species} <span className="muted">Lv{mon.level}</span>
            {mon.status && <span className={`status status-${mon.status}`}>{mon.status}</span>}
          </div>
          <div className="hpbar">
            <div
              className="hpbar-fill"
              style={{
                width: `${mon.hpPercent}%`,
                background:
                  mon.hpPercent > 50 ? '#4caf50' : mon.hpPercent > 20 ? '#ffb300' : '#e53935',
              }}
            />
          </div>
          <div className="hp-text">
            {mon.hp}/{mon.maxhp} HP
          </div>
        </>
      ) : (
        <div className="muted">—</div>
      )}
    </div>
  );
}

/** Pokémon sprite: animated by default, falls back to the static gen5 sprite.
 * Always front-facing (both ally and foe), shiny-aware. */
function MonImg({
  species,
  foe,
  anim,
  shiny,
}: {
  species: string;
  foe: boolean;
  anim?: Fx;
  shiny?: boolean;
}) {
  const [stage, setStage] = useState(0); // 0 = animated gif, 1 = static png fallback
  useEffect(() => {
    setStage(0);
  }, [species]);

  const animated = monSpriteAnim(species, shiny);
  const still = monSprite(species, shiny);
  const src = stage === 0 ? animated : still;
  const fxClass =
    anim === 'hit' ? 'fx-hit' : anim === 'atk' ? (foe ? 'fx-atk-foe' : 'fx-atk-ally') : '';

  return (
    <img
      key={species + stage}
      src={src}
      alt={species}
      className={`pixel battle-sprite ${fxClass}`}
      onError={() => setStage((s) => Math.min(s + 1, 1))}
    />
  );
}

/** Move/switch buttons, or the end-of-battle result. Used by CPU and online battles. */
export function BattleControls({
  req,
  ended,
  resultTitle,
  resultNote,
  waiting,
  onChoose,
  onExit,
  exitLabel,
}: {
  req: RequestView;
  ended: boolean;
  resultTitle: string;
  resultNote?: string;
  waiting?: boolean;
  onChoose: (choice: string) => void;
  onExit: () => void;
  exitLabel: string;
}) {
  return (
    <div className="controls">
      {ended ? (
        <div className="result">
          <h2>{resultTitle}</h2>
          {resultNote && <p className="muted">{resultNote}</p>}
          <button className="primary" onClick={onExit}>
            {exitLabel}
          </button>
        </div>
      ) : waiting || req.wait ? (
        <div className="prompt muted">Waiting for opponent…</div>
      ) : req.forceSwitch ? (
        <>
          <div className="prompt">Your Pokémon fainted — choose a replacement:</div>
          <div className="switch-row">
            {req.switches.map((s) => (
              <button key={s.slot} onClick={() => onChoose(`switch ${s.slot}`)}>
                {s.species} ({Math.ceil((s.hp / s.maxhp) * 100) || 0}% HP)
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="move-row">
            {req.moves.map((m) => (
              <button
                key={m.slot}
                className="move-btn"
                disabled={m.disabled}
                onClick={() => onChoose(`move ${m.slot}`)}
              >
                <span className="move-name">{m.name}</span>
                <span className="move-pp">
                  {m.pp}/{m.maxpp} PP
                </span>
              </button>
            ))}
          </div>
          {req.switches.length > 0 && (
            <div className="switch-row">
              <span className="muted">Switch:</span>
              {req.switches.map((s) => (
                <button key={s.slot} onClick={() => onChoose(`switch ${s.slot}`)}>
                  {s.species}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
