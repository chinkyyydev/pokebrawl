import type { BattleController, SideID } from './battle';

/**
 * Dead-simple CPU: switch in the first healthy bench Pokémon when forced,
 * otherwise pick a random usable move (or switch if somehow no moves).
 * Replace with a damage-calc-driven AI later.
 */
export function chooseCpuMove(ctrl: BattleController, side: SideID = 'p2'): string {
  const req = ctrl.request(side);
  if (req.wait) return '';

  if (req.forceSwitch) {
    const target = req.switches[0];
    return target ? `switch ${target.slot}` : 'pass';
  }

  const usable = req.moves.filter((m) => !m.disabled && m.pp > 0);
  if (usable.length > 0) {
    const pick = usable[Math.floor(Math.random() * usable.length)];
    return `move ${pick.slot}`;
  }

  if (req.switches.length > 0) {
    return `switch ${req.switches[0].slot}`;
  }

  // No moves, no switches: forfeit the turn (Struggle is auto-selected by sim).
  return 'move 1';
}
