// Wrapper around @pkmn/sim's Battle — Pokémon Showdown's real simulator.
// We use the "gen9customgame" format, which runs full mechanics but skips
// team validation (so any species/move combo is allowed for now).
import { Battle } from '@pkmn/sim';
import type { PokemonSet } from '@pkmn/sim';

export type SideID = 'p1' | 'p2';

export interface ActiveView {
  name: string;
  species: string;
  hp: number;
  maxhp: number;
  hpPercent: number;
  fainted: boolean;
  status: string;
  level: number;
}

export interface MoveOption {
  name: string;
  id: string;
  pp: number;
  maxpp: number;
  disabled: boolean;
  slot: number; // 1-based, for `move N`
}

export interface SwitchOption {
  name: string;
  species: string;
  hp: number;
  maxhp: number;
  fainted: boolean;
  slot: number; // 1-based index in party, for `switch N`
}

export interface RequestView {
  moves: MoveOption[];
  switches: SwitchOption[];
  forceSwitch: boolean;
  wait: boolean;
}

export class BattleController {
  readonly battle: Battle;
  private logIndex = 0;

  constructor(p1team: PokemonSet[], p2team: PokemonSet[], p1name = 'You', p2name = 'CPU') {
    this.battle = new Battle({ formatid: 'gen9customgame' as never });
    this.battle.setPlayer('p1', { name: p1name, team: p1team });
    this.battle.setPlayer('p2', { name: p2name, team: p2team });

    // gen9customgame opens with a Team Preview request. We don't have a
    // team-preview screen, so auto-pick default lead order (slot 1 leads) for
    // both sides, which advances the battle to turn 1 with real move choices.
    if (this.battle.sides.some((s) => (s.activeRequest as { teamPreview?: boolean })?.teamPreview)) {
      this.battle.makeChoices('default', 'default');
    }
  }

  get ended(): boolean {
    return this.battle.ended;
  }

  get winner(): string | undefined {
    return this.battle.winner ?? undefined;
  }

  /** Which side won — trusts the sim's own `battle.winner` (the authoritative
   * tie/win signal, set via Battle#win()/#tie()) rather than re-deriving it
   * from pokemonLeft, which doesn't reliably reach a true 0-vs-0 state even
   * on a genuine mutual KO (the sim ends the battle as soon as either side
   * hits 0, short-circuiting before the other side's faint is counted) — that
   * previously meant a real tie (e.g. mutual Explosion KO, or a turn-limit
   * tie) could get silently misattributed to whichever side happened to be
   * checked first, paying out the full pot to the wrong/no winner. */
  winnerSide(): SideID | null {
    if (!this.battle.ended) return null;
    const winnerName = this.battle.winner;
    if (!winnerName) return null; // tie — battle.winner is '' for Battle#tie()
    const side = this.battle.sides.find((s) => s.name === winnerName);
    return (side?.id as SideID) ?? null;
  }

  private side(id: SideID) {
    return this.battle.sides.find((s) => s.id === id)!;
  }

  active(id: SideID): ActiveView | null {
    const mon = this.side(id).active[0];
    if (!mon) return null;
    return {
      name: mon.name,
      species: mon.species.name,
      hp: mon.hp,
      maxhp: mon.maxhp,
      hpPercent: mon.maxhp ? Math.ceil((mon.hp / mon.maxhp) * 100) : 0,
      fainted: mon.fainted,
      status: mon.status || '',
      level: mon.level,
    };
  }

  party(id: SideID): SwitchOption[] {
    return this.side(id).pokemon.map((mon, i) => ({
      name: mon.name,
      species: mon.species.name,
      hp: mon.hp,
      maxhp: mon.maxhp,
      fainted: mon.fainted,
      slot: i + 1,
    }));
  }

  request(id: SideID): RequestView {
    const req = this.side(id).activeRequest as any;
    if (!req || req.wait) {
      return { moves: [], switches: [], forceSwitch: false, wait: true };
    }

    const forceSwitch = Array.isArray(req.forceSwitch) && req.forceSwitch[0] === true;

    const moves: MoveOption[] = forceSwitch
      ? []
      : ((req.active?.[0]?.moves ?? []) as any[]).map((mv, i) => ({
          name: mv.move,
          id: mv.id,
          pp: mv.pp ?? 0,
          maxpp: mv.maxpp ?? 0,
          disabled: !!mv.disabled,
          slot: i + 1,
        }));

    // Bench Pokémon eligible to switch in (alive + not currently active).
    const switches: SwitchOption[] = this.side(id)
      .pokemon.map((mon, i) => ({ mon, slot: i + 1 }))
      .filter(({ mon }) => !mon.fainted && !mon.isActive)
      .map(({ mon, slot }) => ({
        name: mon.name,
        species: mon.species.name,
        hp: mon.hp,
        maxhp: mon.maxhp,
        fainted: mon.fainted,
        slot,
      }));

    return { moves, switches, forceSwitch, wait: false };
  }

  /** Advance the battle with both sides' choice strings (e.g. "move 1", "switch 3", ""). */
  makeChoices(p1: string, p2: string): { ok: boolean; error?: string } {
    try {
      this.battle.makeChoices(p1, p2);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /** New human-readable log lines since the last call. */
  drainLog(): string[] {
    const fresh = this.battle.log.slice(this.logIndex);
    this.logIndex = this.battle.log.length;
    const out: string[] = [];
    for (let i = 0; i < fresh.length; i++) {
      // Showdown emits `|split|SIDE` followed by two lines: a secret one (exact
      // HP, for that side) and a public one (for everyone else). Keep just one
      // so messages don't appear twice.
      if (fresh[i].startsWith('|split|')) {
        const line = translate(fresh[i + 2] ?? fresh[i + 1] ?? '');
        if (line) out.push(line);
        i += 2;
        continue;
      }
      const line = translate(fresh[i]);
      if (line) out.push(line);
    }
    return out;
  }
}

/** Translate a subset of Showdown's protocol lines into readable text. */
function translate(line: string): string | null {
  const parts = line.split('|');
  const tag = parts[1];
  switch (tag) {
    case 'move':
      return `${nick(parts[2])} used ${parts[3]}!`;
    case 'switch':
    case 'drag':
      return `${parts[2].split(':')[0].slice(0, 3) === 'p1a' ? 'You sent out' : 'Opponent sent out'} ${parts[3].split(',')[0]}!`;
    case '-damage':
      return `${nick(parts[2])} took damage (${hpText(parts[3])}).`;
    case '-heal':
      return `${nick(parts[2])} restored HP (${hpText(parts[3])}).`;
    case '-status':
      return `${nick(parts[2])} was afflicted with ${parts[3]}.`;
    case '-supereffective':
      return `It's super effective!`;
    case '-resisted':
      return `It's not very effective...`;
    case '-immune':
      return `It had no effect on ${nick(parts[2])}.`;
    case '-crit':
      return `A critical hit!`;
    case '-miss':
      return `${nick(parts[2])}'s attack missed!`;
    case 'faint':
      return `${nick(parts[2])} fainted!`;
    case '-weather':
      return parts[2] && parts[2] !== 'none' ? `The weather is ${parts[2]}.` : null;
    case 'turn':
      return `— Turn ${parts[2]} —`;
    case 'win':
      return `🏆 ${parts[2]} wins!`;
    default:
      return null;
  }
}

function nick(ref?: string): string {
  if (!ref) return 'A Pokémon';
  const name = ref.split(':')[1]?.trim() ?? ref;
  return name;
}

function hpText(hp?: string): string {
  if (!hp) return '';
  if (hp === '0 fnt') return 'fainted';
  return hp.split(' ')[0];
}
