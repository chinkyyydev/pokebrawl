// Wire protocol shared by the client and the authoritative server.
import type { PokemonSet } from '@pkmn/sim';
import type { ActiveView, RequestView, SwitchOption } from '../game/battle';

export const STAKE_TIERS = [0.1, 0.5, 1, 5, 10] as const;

export interface SideView {
  name: string;
  active: ActiveView | null;
  party: SwitchOption[];
}

/** Authoritative battle snapshot, already framed from the recipient's POV. */
export interface BattleStateMsg {
  type: 'state';
  stake: number;
  you: SideView;
  foe: SideView;
  request: RequestView; // what YOU may do right now
  log: string[]; // new human-readable lines since the last state
  ended: boolean;
  winner: 'you' | 'foe' | null;
}

export type ClientMsg =
  | { type: 'queue'; stake: number; name: string; team: PokemonSet[] }
  | { type: 'cancel' }
  | { type: 'choice'; choice: string }
  | { type: 'leave' };

export type ServerMsg =
  | { type: 'queued'; stake: number; players: number }
  | { type: 'matchFound'; opponentName: string }
  | BattleStateMsg
  | { type: 'opponentLeft' }
  | { type: 'error'; message: string };
