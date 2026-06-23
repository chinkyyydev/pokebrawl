import { useEffect, useRef, useState } from 'react';
import type { PokemonSet } from '@pkmn/sim';
import { TitleScreen } from './components/TitleScreen';
import { CharacterCreate } from './components/CharacterCreate';
import { Town } from './components/Town';
import { ResearchCenter } from './components/ResearchCenter';
import { TeamBuilder } from './components/TeamBuilder';
import { StarterDraft } from './components/StarterDraft';
import { BuyPokemon } from './components/BuyPokemon';
import { Lobby } from './components/Lobby';
import { BattleView } from './components/BattleView';
import { OnlineMatch } from './components/OnlineMatch';
import { randomTeam, randomMember, sampleSpecies } from './game/randomTeam';
import { rollShiny } from './game/shiny';
import { getSpecies } from './data/pokedex';
import { toPokemonSet, type Team, type TeamMember } from './types';
import { useWallet } from './solana/wallet';
import { claimReward } from './solana/coin';
import {
  clearProfile,
  createProfile,
  loadProfile,
  saveProfile,
  LEVEL_MILESTONES,
  WIN_COIN_REWARD,
  WELCOME_COIN_GRANT,
  RENTAL_DURATION_MS,
  type Profile,
} from './state/storage';

/**
 * Two repair jobs that both need an async dice-roll, run together so there's
 * only one "fix the profile" pass:
 *  1. Any rented Pokémon whose 24h loan expired gets swapped for a fresh
 *     random Pokémon (everywhere it appears — collection and team slots).
 *  2. Any legacy collection entry from before ability/nature/item/moves were
 *     rolled-and-locked at acquisition time (an old save) gets a proper
 *     random roll now, so it isn't permanently stuck "incomplete" with no
 *     way to fix it (the team builder no longer lets you edit these by hand).
 * Returns the same `p` reference if nothing needed fixing, so callers can
 * skip the state update.
 */
async function repairProfile(p: Profile): Promise<Profile> {
  const now = Date.now();
  const legacyIncomplete = p.collection.filter((m) => m.moves.length === 0);
  if (!p.rentals.some((r) => r.expiresAt <= now) && legacyIncomplete.length === 0) return p;

  let collection = p.collection;
  const replacedBy = new Map<string, TeamMember>(); // old species (lower) -> new member

  for (const m of legacyIncomplete) {
    const sp = getSpecies(m.species);
    if (!sp) continue;
    const fresh = await randomMember(sp);
    fresh.shiny = m.shiny;
    replacedBy.set(m.species.toLowerCase(), fresh);
    collection = collection.map((e) =>
      e.species.toLowerCase() === m.species.toLowerCase() ? fresh : e,
    );
  }

  const rentals = await Promise.all(
    p.rentals.map(async (r) => {
      if (r.expiresAt > now) return r;
      const exclude = [...collection.map((e) => e.species), ...p.rentals.map((x) => x.species)];
      const [next] = sampleSpecies(1, exclude);
      if (!next) return r; // pool exhausted — keep the current one
      const member = await randomMember(next);
      member.shiny = rollShiny();
      replacedBy.set(r.species.toLowerCase(), member);
      collection = [
        ...collection.filter((e) => e.species.toLowerCase() !== r.species.toLowerCase()),
        member,
      ];
      return { species: next.name, expiresAt: now + RENTAL_DURATION_MS };
    }),
  );

  const teams = p.teams.map((t) => ({
    ...t,
    members: t.members.map((m) => {
      const next = m && replacedBy.get(m.species.toLowerCase());
      return next ?? m;
    }),
  }));

  return { ...p, collection, rentals, teams };
}

type Scene =
  | { name: 'title' }
  | { name: 'create' }
  | { name: 'town' }
  | { name: 'starterDraft' }
  | { name: 'buyPokemon' }
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
  if (!profile.starterDraftDone) return { name: 'starterDraft' };
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
  const { address } = useWallet();
  const [reward, setReward] = useState<string | null>(null); // "Level 10! New Pokémon: X"
  const profileRef = useRef(profile);
  profileRef.current = profile;

  // Persist on every profile change. Swap this for wallet/backend later.
  useEffect(() => {
    if (profile) saveProfile(profile);
  }, [profile]);

  // Catch rental expiries + legacy data repair: once immediately (covers
  // time passed while the tab was closed) and every 60s while it stays open.
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    async function check() {
      const current = profileRef.current;
      if (!current) return;
      const next = await repairProfile(current);
      if (!cancelled && next !== current) setProfile(next);
    }
    check();
    const id = setInterval(check, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [!!profile]);

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

  // Record an online (PvP) match result onto the profile's W/L. Wins also
  // level the player up: every 5 levels (up to 25) grants a free random
  // Pokémon, and — if a wallet is connected — a small coin reward.
  function recordResult(won: boolean) {
    let wins = 0;
    setProfile((p) => {
      if (!p) return p;
      wins = p.wins + (won ? 1 : 0);
      return { ...p, wins, level: wins, losses: p.losses + (won ? 0 : 1) };
    });
    if (won && address) claimReward(address, WIN_COIN_REWARD);
    if (won && LEVEL_MILESTONES.includes(wins)) {
      const current = profileRef.current;
      const [drop] = sampleSpecies(1, current?.collection.map((m) => m.species) ?? []);
      if (drop) {
        randomMember(drop).then((member) => {
          member.shiny = rollShiny();
          setProfile((p) => (p ? { ...p, collection: [...p.collection, member] } : p));
          setReward(`${member.shiny ? '✨ SHINY ' : ''}Level ${wins}! New Pokémon: ${drop.name}`);
        });
      }
    }
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
            setScene({ name: 'starterDraft' });
          }}
        />
      );
    }

    switch (scene.name) {
      case 'starterDraft':
        return (
          <StarterDraft
            onDone={(members) => {
              members.forEach((m) => {
                m.shiny = rollShiny();
              });
              const rest = members.slice(1);
              const expiresAt = Date.now() + RENTAL_DURATION_MS;
              setProfile((p) =>
                p
                  ? {
                      ...p,
                      collection: members,
                      starterDraftDone: true,
                      rentals: rest.map((m) => ({ species: m.species, expiresAt })),
                      teams: p.teams.map((t, i) => (i === 0 ? { ...t, members } : t)),
                    }
                  : p,
              );
              if (address) claimReward(address, WELCOME_COIN_GRANT);
              setScene({ name: 'town' });
            }}
          />
        );

      case 'buyPokemon':
        return (
          <BuyPokemon
            collection={profile.collection}
            onBought={(species) => {
              const sp = getSpecies(species);
              if (!sp) return;
              randomMember(sp).then((member) => {
                member.shiny = rollShiny();
                setProfile((p) => (p ? { ...p, collection: [...p.collection, member] } : p));
              });
            }}
            onBack={() => setScene({ name: 'town' })}
          />
        );

      case 'town':
        return (
          <Town
            profile={profile}
            reward={reward}
            onDismissReward={() => setReward(null)}
            onResearch={() => setScene({ name: 'research' })}
            onBattle={() => setScene({ name: 'lobby' })}
            onBuy={() => setScene({ name: 'buyPokemon' })}
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
            collection={profile.collection}
            rentals={profile.rentals}
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
