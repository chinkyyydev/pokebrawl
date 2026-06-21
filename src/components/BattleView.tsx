import { useEffect, useRef, useState } from 'react';
import type { PokemonSet } from '@pkmn/sim';
import { BattleController } from '../game/battle';
import { chooseCpuMove } from '../game/ai';
import { Combatant, BattleControls, type Fx } from './BattleField';

export function BattleView({
  playerTeam,
  cpuTeam,
  stake,
  onExit,
}: {
  playerTeam: PokemonSet[];
  cpuTeam: PokemonSet[];
  stake: number;
  onExit: () => void;
}) {
  const ctrlRef = useRef<BattleController | null>(null);
  const initLogRef = useRef<string[]>([]);

  // Build the battle exactly once, capturing the opening log.
  if (!ctrlRef.current) {
    const c = new BattleController(playerTeam, cpuTeam);
    const opening = c.drainLog();
    const more = advanceUntilPlayerActs(c);
    initLogRef.current = [...opening, ...more];
    ctrlRef.current = c;
  }
  const ctrl = ctrlRef.current;

  const [log, setLog] = useState<string[]>(() => initLogRef.current);
  const [, setTick] = useState(0);
  const [fx, setFx] = useState<{ p1?: Fx; p2?: Fx }>({});
  const fxTimer = useRef<number | undefined>(undefined);
  const logBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    logBoxRef.current?.scrollTo({ top: logBoxRef.current.scrollHeight });
  });

  function choose(choice: string) {
    if (ctrl.ended) return;

    const beforeP1 = ctrl.active('p1')?.hp ?? 0;
    const beforeP2 = ctrl.active('p2')?.hp ?? 0;
    const playerAttacked = choice.startsWith('move');

    const cpu = chooseCpuMove(ctrl, 'p2');
    const cpuAttacked = cpu.startsWith('move');
    const res = ctrl.makeChoices(choice, cpu);
    const lines = ctrl.drainLog();
    if (!res.ok && res.error) lines.push(`⚠️ ${res.error}`);
    lines.push(...advanceUntilPlayerActs(ctrl));

    const afterP1 = ctrl.active('p1')?.hp ?? 0;
    const afterP2 = ctrl.active('p2')?.hp ?? 0;
    const next: { p1?: Fx; p2?: Fx } = {};
    next.p1 = afterP1 < beforeP1 ? 'hit' : playerAttacked ? 'atk' : undefined;
    next.p2 = afterP2 < beforeP2 ? 'hit' : cpuAttacked ? 'atk' : undefined;
    setFx(next);
    window.clearTimeout(fxTimer.current);
    fxTimer.current = window.setTimeout(() => setFx({}), 650);

    setLog((l) => [...l, ...lines]);
    setTick((t) => t + 1);
  }

  const p1 = ctrl.active('p1');
  const p2 = ctrl.active('p2');
  const req = ctrl.request('p1');
  const won = ctrl.winner === 'You';

  return (
    <div className="battle">
      <div className="battle-top">
        <div className="stake-pill">Practice · {stake} SOL (mock)</div>
        <button onClick={onExit}>Forfeit / Exit</button>
      </div>

      <div className="field">
        <Combatant who="CPU" mon={p2} party={ctrl.party('p2')} foe anim={fx.p2} />
        <Combatant who="You" mon={p1} party={ctrl.party('p1')} anim={fx.p1} />
      </div>

      <BattleControls
        req={req}
        ended={ctrl.ended}
        resultTitle={won ? '🏆 You won!' : 'You lost.'}
        resultNote={
          won
            ? `(Payout of ~${stake * 2} SOL would settle here once Solana escrow is wired up.)`
            : `(Your ${stake} SOL stake would go to the opponent here.)`
        }
        onChoose={choose}
        onExit={onExit}
        exitLabel="Back to lobby"
      />

      <div className="log" ref={logBoxRef}>
        {log.map((line, i) => (
          <div key={i} className="log-line">
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Auto-resolve turns where the player has nothing to decide (CPU acts alone). */
function advanceUntilPlayerActs(ctrl: BattleController): string[] {
  const all: string[] = [];
  for (let guard = 0; guard < 50; guard++) {
    if (ctrl.ended) break;
    const preq = ctrl.request('p1');
    if (!preq.wait) break; // player must choose — hand control back
    const creq = ctrl.request('p2');
    if (creq.wait) break; // nobody can act; avoid an infinite loop
    const cpu = chooseCpuMove(ctrl, 'p2');
    ctrl.makeChoices('', cpu);
    all.push(...ctrl.drainLog());
  }
  return all;
}
