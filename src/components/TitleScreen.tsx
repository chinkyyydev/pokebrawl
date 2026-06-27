import { useWallet } from '../solana/wallet';
import { WalletButton } from './WalletButton';

export function TitleScreen({ onStart }: { onStart: () => void }) {
  const { address } = useWallet();

  return (
    <div className="scene title-scene">
      <div className="title-logo">
        POKéMON
        <span className="title-logo-sub">1 v 1</span>
      </div>
      <div className="title-tag">SOLANA BATTLE STADIUM</div>

      <div className="title-actions">
        {/* Free path: jump straight in — no wallet needed. */}
        <button className="press-start" onClick={onStart}>
          {address ? '▶ ENTER STADIUM' : '▶ PLAY FREE'}
        </button>

        <div className="title-or">— or connect a wallet —</div>

        {/* Wallet path: only ever talks to Phantom when this is clicked. */}
        <WalletButton />
      </div>

      <p className="title-foot">
        Free vs CPU &amp; real trainers · SOL wagering on devnet
      </p>
    </div>
  );
}
