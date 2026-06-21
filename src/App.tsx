import { useEffect, useState } from 'react';
import type { PokemonSet } from '@pkmn/sim';
import { TitleScreen } from './components/TitleScreen';
import { CharacterCreate } from './components/CharacterCreate';
import { Town } from './components/Town';
import { ResearchCenter } from './components/ResearchCenter';
import { TeamBuilder } from './components/TeamBuilder';
import { Lobby } from './components/Lobby';
import { BattleView } from './components/BattleView';
import { OnlineMatch } from './components/OnlineMatch';
import { randomTeam } from './game/randomTeam';
import { toPokemonSet, type Team, type TeamMember } from './types';
import {
  clearProfile,
  createProfile,
  loadProfile,
  saveProfile,
  type Profile,
} from './state/storage';

type Scene =
  | { name: 'title' }
  | { name: 'create' }
  | { name: 'town' }
  | { name: 'research' }
  | { name: 'builder'; teamIndex: number }
  | { name: 'lobby' }
  | { name: 'loading'; stake: number; members: Team }
  | { name: 'battle'; stake: number; player: PokemonSet[]; cpu: PokemonSet[] }
  | { name: 'online'; stake: number; members: Team };

function setsFrom(members: Team): PokemonSet[] {
  return members
    .filter((m): m is TeamMember => !!m && m.moves.filter(Boolean).length > 0)
    .map(toPokemonSet);
}

const SCENE_KEY = 'pokemon1v1:scene';

// Restore the last navigation scene on refresh. Battle/online scenes can't be
// resumed (their state lives on the server / in memory), so they fall back to town.
function restoreScene(profile: Profile | null): Scene {
  if (!profile) return { name: 'title' };
  try {
    const raw = localStorage.getItem(SCENE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Scene;
      if (s.name === 'town' || s.name === 'research' || s.name === 'lobby') return s;
      if (
        s.name === 'builder' &&
        typeof s.teamIndex === 'number' &&
        s.teamIndex >= 0 &&
        s.teamIndex < profile.teams.length
      ) {
        return s;
      }
    }
  } catch {
    /* ignore */
  }
  return { name: 'town' };
}

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile());
  const [scene, setScene] = useState<Scene>(() => restoreScene(profile));

  // Persist on every profile change. Swap this for wallet/backend later.
  useEffect(() => {
    if (profile) saveProfile(profile);
  }, [profile]);

  // Remember where the player is so a refresh resumes here (not the title).
  useEffect(() => {
    const persist: Scene =
      scene.name === 'builder'
        ? { name: 'builder', teamIndex: scene.teamIndex }
        : scene.name === 'research' || scene.name === 'lobby' || scene.name === 'town'
          ? { name: scene.name }
          : { name: 'town' }; // battle/online/loading/title/create -> town on refresh
    try {
      localStorage.setItem(SCENE_KEY, JSON.stringify(persist));
    } catch {
      /* ignore */
    }
  }, [scene]);

  function updateTeamMembers(index: number, members: Team) {
    setProfile((p) =>
      p
        ? { ...p, teams: p.teams.map((t, i) => (i === index ? { ...t, members } : t)) }
        : p,
    );
  }

  function renameTeam(index: number, name: string) {
    setProfile((p) =>
      p ? { ...p, teams: p.teams.map((t, i) => (i === index ? { ...t, name } : t)) } : p,
    );
  }

  async function startMatch(stake: number, members: Team) {
    setScene({ name: 'loading', stake, members });
    const player = setsFrom(members);
    const cpu = (await randomTeam(player.length || undefined)).map(toPokemonSet);
    setScene({ name: 'battle', stake, player, cpu });
  }

  // Record an online (PvP) match result onto the profile's W/L.
  function recordResult(won: boolean) {
    setProfile((p) =>
      p ? { ...p, wins: p.wins + (won ? 1 : 0), losses: p.losses + (won ? 0 : 1) } : p,
    );
  }

  return (
    <div className="game-frame">
      <div className="screen">{renderScene()}</div>
    </div>
  );

  function renderScene() {
    if (scene.name === 'title') {
      return (
        <TitleScreen
          onStart={() => setScene(profile ? { name: 'town' } : { name: 'create' })}
        />
      );
    }

    if (scene.name === 'create' || !profile) {
      return (
        <CharacterCreate
          onCreate={(name, trainer) => {
            setProfile(createProfile(name, trainer));
            setScene({ name: 'town' });
          }}
        />
      );
    }

    switch (scene.name) {
      case 'town':
        return (
          <Town
            profile={profile}
            onResearch={() => setScene({ name: 'research' })}
            onBattle={() => setScene({ name: 'lobby' })}
            onReset={() => {
              clearProfile();
              setProfile(null);
              setScene({ name: 'create' });
            }}
          />
        );

      case 'research':
        return (
          <ResearchCenter
            profile={profile}
            onEditTeam={(teamIndex) => setScene({ name: 'builder', teamIndex })}
            onSetActive={(i) => setProfile({ ...profile, activeTeam: i })}
            onBack={() => setScene({ name: 'town' })}
          />
        );

      case 'builder': {
        const idx = scene.teamIndex;
        const team = profile.teams[idx];
        return (
          <TeamBuilder
            team={team.members}
            teamName={team.name}
            onChange={(members) => updateTeamMembers(idx, members)}
            onRename={(name) => renameTeam(idx, name)}
            onDone={() => setScene({ name: 'research' })}
          />
        );
      }

      case 'lobby':
        return (
          <Lobby
            profile={profile}
            onBack={() => setScene({ name: 'town' })}
            onOnline={(stake, members) => setScene({ name: 'online', stake, members })}
            onPractice={startMatch}
          />
        );

      case 'loading':
        return <div className="loading">Setting up your practice battle…</div>;

      case 'battle':
        return (
          <BattleView
            playerTeam={scene.player}
            cpuTeam={scene.cpu}
            onExit={() => setScene({ name: 'town' })}
          />
        );

      case 'online':
        return (
          <OnlineMatch
            name={profile.name}
            stake={scene.stake}
            members={scene.members}
            onResult={recordResult}
            onExit={() => setScene({ name: 'town' })}
          />
        );

      default:
        return null;
    }
  }
}
