/** The actual rules text — shared by the one-time onboarding scene
 * (RulesScene.tsx) and the "📖 Rules" popup available anytime. */
export function RulesContent() {
  return (
    <div className="rules-content">
      <h3>🎒 Team Building</h3>
      <p>Save up to 3 teams of 3 Pokémon — build and manage them in the Research Center.</p>

      <h3>🎲 Catching Pokémon</h3>
      <p>
        Every Pokémon you get — from your starter draft, leveling up, or the Poké Shop — rolls a
        random ability, nature, held item, and 4 moves the instant you catch it. Every legal
        option has equal odds, and that roll is <strong>permanent</strong> — it can't be changed
        afterward, so it's worth checking what you got!
      </p>

      <h3>🥚 Starter Draft</h3>
      <p>
        When you start, pick 1 of 3 random Pokémon to keep forever. The other two join your first
        team on a 24-hour rental — they'll automatically swap for new random Pokémon once the loan
        runs out.
      </p>

      <h3>📈 Leveling Up</h3>
      <p>Win online matches to level up. Every 5 levels (up to 25) gets you one more free random Pokémon.</p>

      <h3>★ Legendaries</h3>
      <p>Legendary and Mythical Pokémon are powerful — every team is capped at 1 Legendary.</p>

      <h3>⚔️ Battling</h3>
      <p>
        Practice anytime vs the CPU for free. Online matches you against real trainers — free
        for fun, or wager real SOL with a connected wallet. Each turn has a 45-second timer
        backed by a 7-minute match clock, so matches keep moving.
      </p>

      <h3>✨ Shiny Pokémon</h3>
      <p>Every Pokémon has a 1-in-1000 chance to be shiny when you get it — purely cosmetic, but fun to find!</p>
    </div>
  );
}
