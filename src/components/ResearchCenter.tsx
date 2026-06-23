import type { Profile } from '../state/storage';
import { PARTY_SIZE, teamCount, teamIsReady } from '../state/storage';
import { monSprite } from '../data/sprites';
import { getSpecies } from '../data/pokedex';
import { isLegendary } from '../data/bans';
import { DialogBox } from './DialogBox';
import type { TeamMember } from '../types';

function hoursLeft(expiresAt: number): number {
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 3_600_000));
}

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
  const inventory = profile.collection
    .map((entry) => ({ entry, species: getSpecies(entry.species) }))
    .sort((a, b) => (a.species?.num ?? 0) - (b.species?.num ?? 0));

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
                        <img
                          src={monSprite(m.species, m.shiny)}
                          alt={m.species}
                          className="pixel"
                        />
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

      <h3 className="section-label">
        POKÉMON INVENTORY ({inventory.length} discovered)
      </h3>
      {inventory.length === 0 ? (
        <p className="muted">Nothing caught yet — visit the Poké Shop or win a few battles!</p>
      ) : (
        <div className="inventory-grid">
          {inventory.map(({ entry, species }) => {
            const rental = profile.rentals.find(
              (r) => r.species.toLowerCase() === entry.species.toLowerCase(),
            );
            const teamIndex = profile.teams.findIndex((t) =>
              t.members.some(
                (m) => m && m.species.toLowerCase() === entry.species.toLowerCase(),
              ),
            );
            return (
              <div key={entry.species} className="inventory-card">
                <img
                  src={monSprite(entry.species, entry.shiny)}
                  alt={entry.species}
                  className="pixel"
                />
                <span className="inventory-name">
                  {entry.species}
                  {entry.shiny && <span className="shiny-tag">✨</span>}
                </span>
                {species && (
                  <span className="dex-types">
                    {species.types.map((t) => (
                      <span key={t} className={`type type-${t.toLowerCase()}`}>
                        {t}
                      </span>
                    ))}
                  </span>
                )}
                {isLegendary(entry.species) && (
                  <span className="legendary-tag">★ LEGENDARY</span>
                )}
                {rental && (
                  <span className="inventory-meta">🕒 Rented · {hoursLeft(rental.expiresAt)}h left</span>
                )}
                <span className="inventory-meta">
                  {teamIndex >= 0 ? `In ${profile.teams[teamIndex].name}` : 'Not on a team'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="scene-foot">
        <button className="link-btn" onClick={onBack}>
          ← Back to town
        </button>
      </div>
    </div>
  );
}
