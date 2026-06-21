import { toID } from '@pkmn/dex';

// Pixel sprites straight from the Pokémon Showdown sprite server. Gen-5 sprites
// are the classic 2D pixel art that fits the 8-bit look. If a sprite 404s the
// <img> just shows its alt text, so this degrades gracefully.
const BASE = 'https://play.pokemonshowdown.com/sprites';

export function monSprite(species: string): string {
  return `${BASE}/gen5/${toID(species)}.png`;
}

export function monSpriteBack(species: string): string {
  return `${BASE}/gen5-back/${toID(species)}.png`;
}

// Animated (idle-bobbing) sprites. Not every species has one, so callers should
// fall back to the static gen5 sprites above on load error.
export function monSpriteAnim(species: string): string {
  return `${BASE}/ani/${toID(species)}.gif`;
}

export function monSpriteAnimBack(species: string): string {
  return `${BASE}/ani-back/${toID(species)}.gif`;
}

/** A handful of trainer sprites players can pick as their avatar. */
export const TRAINERS = [
  'red', 'leaf', 'ethan', 'lyra', 'brendan', 'may',
  'lucas', 'dawn', 'hilbert', 'hilda', 'nate', 'rosa',
];

export function trainerSprite(id: string): string {
  return `${BASE}/trainers/${id}.png`;
}
