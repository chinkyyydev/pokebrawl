import { useEffect, useRef, useState } from 'react';
import { toPokemonSet, type Team, type TeamMember } from '../types';
import { NetClient, WS_URL } from '../net/client';
import type { BattleStateMsg, ServerMsg } from '../net/protocol';
import { Combatant, BattleControls, type Fx } from './BattleField';
import { DialogBox } from './DialogBox';
import { useWallet } from '../solana/wallet';

type Phase = 'connecting' | 'queued' | 'battle' | 'error';

export function OnlineMatch({
  name,
  stake,
  members,
  onExit,
}: {
  name: string;
  stake: number;
  members: Team;
  onExit: () => void;
}) {
  const clientRef = useRef<NetClient | null>(null);
  const prevState = useRef<BattleStateMsg | null>(null);
  const fxTimer = useRef<number | undefined>(undefined);
  const logBoxRef = useRef<HTMLDivElement | null>(null);

  const { address } = useWallet();
  const [phase, setPhase] = useState<Phase>('connecting');
  const [opponent, setOpponent] = useState('');
  const [state, setState] = useState<BattleStateMsg | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [waiting, setWaiting] = useState(false); // submitted a choice, awaiting next turn
  const [fx, setFx] = useState<{ you?: Fx; foe?: Fx }>({});
  const [endNote, setEndNote] = useState<string | null>(null);

  useEffect(() => {
    const team = members
      .filter((m): m is TeamMember => !!m && m.moves.filter(Boolean).length > 0)
      .map(toPokemonSet);

    const client = new NetClient(WS_URL, {
      onOpen: () => {
        client.send({ type: 'queue', stake, name, wallet: address ?? '', team });
        setPhase('queued');
      },
      onMessage: handleMessage,
      onClose: () => setPhase((p) => (p === 'battle' ? p : 'error')),
      onError: () => setPhase('error'),
    });
    clientRef.current = client;
    return () => client.close();
  }, []);

  useEffect(() => {
    logBoxRef.current?.scrollTo({ top: logBoxRef.current.scrollHeight });
  });

  function handleMessage(msg: ServerMsg) {
    switch (msg.type) {
      case 'queued':
        setPhase('queued');
        break;
      case 'matchFound':
        setOpponent(msg.opponentName);
        setPhase('battle');
        break;
      case 'state':
        applyState(msg);
        break;
      case 'opponentLeft':
        setEndNote('Your opponent left — you win by forfeit!');
        break;
      case 'error':
        setEndNote(msg.message);
        setPhase('error');
        break;
    }
  }

  function applyState(msg: BattleStateMsg) {
    // "Hit" shake whenever a side's active HP dropped since the last snapshot.
    const prev = prevState.current;
    const next: { you?: Fx; foe?: Fx } = {};
    if (prev) {
      if ((msg.you.active?.hp ?? 0) < (prev.you.active?.hp ?? 0)) next.you = 'hit';
      if ((msg.foe.active?.hp ?? 0) < (prev.foe.active?.hp ?? 0)) next.foe = 'hit';
    }
    setFx(next);
    window.clearTimeout(fxTimer.current);
    fxTimer.current = window.setTimeout(() => setFx({}), 650);

    prevState.current = msg;
    setState(msg);
    setWaiting(false);
    if (msg.log.length) setLog((l) => [...l, ...msg.log]);
  }

  function choose(choice: string) {
    clientRef.current?.send({ type: 'choice', choice });
    setWaiting(true);
  }

  function leave() {
    clientRef.current?.send({ type: 'leave' });
    onExit();
  }

  if (phase === 'connecting') {
    return (
      <div className="scene online-scene">
        <DialogBox>Connecting to the battle server…</DialogBox>
        <button className="link-btn" onClick={onExit}>
          ← Cancel
        </button>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="scene online-scene">
        <DialogBox speaker="SYSTEM">
          {endNote ?? "Couldn't reach the battle server. Is it running? (npm run server)"}
        </DialogBox>
        <button className="press-start" onClick={onExit}>
          ← Back
        </button>
      </div>
    );
  }

  if (phase === 'queued' || !state) {
    return (
      <div className="scene online-scene">
        <DialogBox speaker="STADIUM CLERK">
          {stake === 0
            ? 'Searching for a trainer to play for fun… '
            : `Searching for an opponent at ${stake} SOL… `}
          (tip: open a second browser tab to face yourself!)
        </DialogBox>
        <div className="searching">🔍 Matchmaking…</div>
        <button
          className="press-start"
          onClick={() => {
            clientRef.current?.send({ type: 'cancel' });
            onExit();
          }}
        >
          ✕ Cancel
        </button>
      </div>
    );
  }

  const ended = state.ended || !!endNote;
  const won = endNote ? true : state.winner === 'you';
  return (
    <div className="battle">
      <div className="battle-top">
        <div className="stake-pill">
          {stake === 0 ? 'Free play' : `${stake} SOL`} · vs {opponent || 'opponent'}
        </div>
        <button onClick={leave}>Forfeit / Exit</button>
      </div>

      <div className="field">
        <Combatant
          who={state.foe.name || 'Opponent'}
          mon={state.foe.active}
          party={state.foe.party}
          foe
          anim={fx.foe}
        />
        <Combatant who="You" mon={state.you.active} party={state.you.party} anim={fx.you} />
      </div>

      <BattleControls
        req={state.request}
        ended={ended}
        waiting={waiting}
        resultTitle={ended ? (won ? '🏆 You won!' : 'You lost.') : ''}
        resultNote={
          endNote ??
          (stake === 0
            ? 'Free play — nothing wagered. GG!'
            : won
              ? `(Payout of ~${stake * 2} SOL would settle here once Solana escrow is wired up.)`
              : `(Your ${stake} SOL stake would go to the opponent here.)`)
        }
        onChoose={choose}
        onExit={onExit}
        exitLabel="Back to town"
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
