export function TitleScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="scene title-scene">
      <div className="title-logo">
        POKéMON
        <span className="title-logo-sub">1 v 1</span>
      </div>
      <div className="title-tag">SOLANA BATTLE STADIUM</div>
      <button className="press-start" onClick={onStart}>
        ▶ PRESS START
      </button>
      <p className="title-foot">devnet build · wager mode</p>
    </div>
  );
}
