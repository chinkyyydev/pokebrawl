// Shiny odds for newly-acquired Pokémon (starter draft, level-up drops, the
// shop, rental rotation) — classic 1-in-1000, independent of species.
export const SHINY_CHANCE = 1 / 1000;

export function rollShiny(): boolean {
  return Math.random() < SHINY_CHANCE;
}
