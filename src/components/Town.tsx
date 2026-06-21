import type { Profile } from '../state/storage';
import { teamIsReady } from '../state/storage';
import { TrainerSprite } from './TrainerSprite';
import { DialogBox } from './DialogBox';
import { WalletButton } from './WalletButton';

export function Town({
  profile,
  onResearch,
  onBattle,
  onReset,
}: {
  profile: Profile;
  onResearch: () => void;
  onBattle: () => void;
  onReset: () => void;
}) {
  const active = profile.teams[profile.activeTeam];
  const ready = active && teamIsReady(active);

  return (
    <div className="scene town-scene">
      <div className="trainer-card">
        <TrainerSprite id={profile.trainer} size={56} animated />
        <div>
          <div className="trainer-name">{profile.name}</div>
          <div className="trainer-sub">
            Active: {active?.name ?? '—'} {ready ? '✓' : '(not ready)'}
          </div>
        </div>
        <div className="trainer-card-right">
          <WalletButton />
        </div>
      </div>

      <DialogBox>
        Welcome to BATTLE TOWN, {profile.name}! Where would you like to go?
      </DialogBox>

      <div className="locations">
        <button className="location-card" onClick={onResearch}>
          <span className="location-emoji">🔬</span>
          <span className="location-name">RESEARCH CENTER</span>
          <span className="location-desc">Build &amp; manage your 3 teams.</span>
        </button>

        <button className="location-card" disabled={!ready} onClick={onBattle}>
          <span className="location-emoji">⚔️</span>
          <span className="location-name">BATTLE STADIUM</span>
          <span className="location-desc">
            {ready ? 'Stake SOL and battle a trainer.' : 'Build a team first!'}
          </span>
        </button>
      </div>

      <div className="town-foot">
        <button className="link-btn" onClick={onReset}>
          Change character
        </button>
      </div>
    </div>
  );
}
