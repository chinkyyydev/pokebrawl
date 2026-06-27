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

  // Trust `disabled` alone — a locked continuation move (Recharge, mid-charge
  // Solar Beam/Dig, Uproar-lock) is reported with pp 0 but disabled: false on
  // purpose (the sim's contract, see Pokemon.getMoves()); also requiring
  // pp > 0 here wrongly excludes it, leaving only switches, which the sim then
  // rejects since you can't switch out of a forced continuation — that combo
  // is exactly what caused "Not all choices done" to repeat every turn.
  const usable = req.moves.filter((m) => !m.disabled);
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

/**
 * Pokémon Champions-style timeout fallback: always the first listed option,
 * not a smart pick — running out the clock shouldn't gift you a good move.
 */
export function chooseTopMove(ctrl: BattleController, side: SideID): string {
  const req = ctrl.request(side);
  if (req.wait) return '';

  if (req.forceSwitch) {
    const target = req.switches[0];
    return target ? `switch ${target.slot}` : 'pass';
  }

  // Trust `disabled` alone — a locked continuation move (Recharge, mid-charge
  // Solar Beam/Dig, Uproar-lock) is reported with pp 0 but disabled: false on
  // purpose (the sim's contract, see Pokemon.getMoves()); also requiring
  // pp > 0 here wrongly excludes it, leaving only switches, which the sim then
  // rejects since you can't switch out of a forced continuation — that combo
  // is exactly what caused "Not all choices done" to repeat every turn.
  const usable = req.moves.filter((m) => !m.disabled);
  if (usable.length > 0) return `move ${usable[0].slot}`;

  if (req.switches.length > 0) return `switch ${req.switches[0].slot}`;

  return 'move 1';
}
