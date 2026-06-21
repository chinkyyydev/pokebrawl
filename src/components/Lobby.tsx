import { useState } from 'react';
import type { Profile } from '../state/storage';
import { teamIsReady, teamCount } from '../state/storage';
import { monSprite } from '../data/sprites';
import type { Team } from '../types';
import { DialogBox } from './DialogBox';
import { WalletButton } from './WalletButton';
import { useWallet } from '../solana/wallet';

const STAKE_TIERS = [0.1, 0.5, 1, 5, 10];

export function Lobby({
  profile,
  onBack,
  onOnline,
  onPractice,
}: {
  profile: Profile;
  onBack: () => void;
  onOnline: (stake: number, members: Team) => void;
  onPractice: (stake: number, members: Team) => void;
}) {
  // Only ready teams are selectable; default to the active one (or first ready).
  const readyIdx = profile.teams.map((t, i) => ({ t, i })).filter(({ t }) => teamIsReady(t));
  const defaultIdx = teamIsReady(profile.teams[profile.activeTeam])
    ? profile.activeTeam
    : readyIdx[0]?.i ?? 0;
  const [picked, setPicked] = useState(defaultIdx);
  const [mode, setMode] = useState<'online' | 'practice'>('online');
  const { address } = useWallet();
  const isOnline = mode === 'online';
  // Free play (stake 0) and practice need no wallet; only real SOL wagers do.
  const canWager = !!address;

  const start = (stake: number) => {
    const members = profile.teams[picked].members;
    if (mode === 'online') onOnline(stake, members);
    else onPractice(stake, members);
  };

  return (
    <div className="scene lobby-scene">
      <DialogBox speaker="STADIUM CLERK">
        Pick your team and mode. <strong>Practice</strong> is a free battle vs the CPU.
        <strong> Online</strong> matches you against a real trainer — play FREE for fun, or wager
        SOL against someone who staked the same. (Devnet — no real SOL yet.)
      </DialogBox>

      <div className="mode-toggle">
        <button className={mode === 'online' ? 'sel' : ''} onClick={() => setMode('online')}>
          🌐 ONLINE
        </button>
        <button className={mode === 'practice' ? 'sel' : ''} onClick={() => setMode('practice')}>
          🤖 PRACTICE (CPU)
        </button>
      </div>

      <h3 className="section-label">CHOOSE TEAM</h3>
      <div className="lobby-teams">
        {readyIdx.map(({ t, i }) => (
          <button
            key={i}
            className={`lobby-team ${picked === i ? 'selected' : ''}`}
            onClick={() => setPicked(i)}
          >
            <div className="lobby-team-name">{t.name}</div>
            <div className="lobby-team-roster">
              {t.members.filter(Boolean).map((m, k) => (
                <img key={k} src={monSprite(m!.species)} alt={m!.species} className="pixel" />
              ))}
            </div>
            <div className="muted">{teamCount(t)}/3</div>
          </button>
        ))}
      </div>

      <h3 className="section-label">{isOnline ? 'CHOOSE STAKE' : 'PRACTICE BATTLE'}</h3>
      {isOnline ? (
        <>
          <div className="tiers">
            {/* Free PvP: matched against a real trainer, no wallet, nothing wagered. */}
            <button className="tier tier-free" onClick={() => start(0)}>
              <span className="tier-amount">FREE</span>
              <span className="tier-vs">vs real trainer</span>
              <span className="tier-pot muted">just for fun</span>
            </button>
            {STAKE_TIERS.map((s) => {
              const locked = !canWager;
              return (
                <button key={s} className="tier" disabled={locked} onClick={() => start(s)}>
                  <span className="tier-amount">{s} SOL</span>
                  <span className="tier-vs">vs {s} SOL</span>
                  <span className="tier-pot muted">{locked ? '🔒 wallet' : `pot ${s * 2}`}</span>
                </button>
              );
            })}
          </div>
          {!canWager && (
            <div className="wallet-gate">
              <p>🔒 Connect a Solana wallet to wager SOL — or play FREE above.</p>
              <WalletButton />
            </div>
          )}
        </>
      ) : (
        // Practice is always free vs CPU — no wallet, no stake.
        <div className="tiers">
          <button className="tier tier-free" onClick={() => start(0)}>
            <span className="tier-amount">FREE</span>
            <span className="tier-vs">vs CPU</span>
            <span className="tier-pot muted">just for fun</span>
          </button>
        </div>
      )}

      <div className="scene-foot">
        <button className="link-btn" onClick={onBack}>
          ← Back to town
        </button>
      </div>

      <p className="disclaimer">
        ⚠️ Real-money wagering is gambling and is heavily regulated. This build runs on Solana
        <strong> devnet</strong> with no real value.
      </p>
    </div>
  );
}
