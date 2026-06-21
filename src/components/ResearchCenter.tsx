import type { Profile } from '../state/storage';
import { PARTY_SIZE, teamCount, teamIsReady } from '../state/storage';
import { monSprite } from '../data/sprites';
import { DialogBox } from './DialogBox';
import type { TeamMember } from '../types';

export function ResearchCenter({
  profile,
  onEditTeam,
  onSetActive,
  onBack,
}: {
  profile: Profile;
  onEditTeam: (index: number) => void;
  onSetActive: (index: number) => void;
  onBack: () => void;
}) {
  return (
    <div className="scene research-scene">
      <DialogBox speaker="PROF. OAK">
        This is my research center. You may keep up to 3 teams of 6 POKéMON. Edit
        them as often as you like — pick which one to battle with before each match.
      </DialogBox>

      <div className="team-slots">
        {profile.teams.map((team, i) => {
          const ready = teamIsReady(team);
          const isActive = profile.activeTeam === i;
          return (
            <div key={i} className={`team-slot-card ${isActive ? 'active' : ''}`}>
              <div className="team-slot-head">
                <span className="team-slot-name">{team.name}</span>
                {isActive && <span className="badge">ACTIVE</span>}
              </div>

              <div className="team-roster">
                {Array.from({ length: PARTY_SIZE }, (_, s) => {
                  const m = team.members[s] as TeamMember | null;
                  return (
                    <div key={s} className={`roster-cell ${m ? 'filled' : ''}`}>
                      {m ? (
                        <img src={monSprite(m.species)} alt={m.species} className="pixel" />
                      ) : (
                        <span className="empty-ball">·</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="team-slot-meta">
                {teamCount(team)}/{PARTY_SIZE} · {ready ? 'battle-ready' : 'incomplete'}
              </div>

              <div className="team-slot-actions">
                <button className="press-start sm" onClick={() => onEditTeam(i)}>
                  EDIT
                </button>
                <button
                  className="sm"
                  disabled={!ready || isActive}
                  onClick={() => onSetActive(i)}
                >
                  {isActive ? 'ACTIVE' : 'USE'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="scene-foot">
        <button className="link-btn" onClick={onBack}>
          ← Back to town
        </button>
      </div>
    </div>
  );
}
