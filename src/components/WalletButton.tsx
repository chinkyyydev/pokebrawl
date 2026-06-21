import { useWallet, shortAddress } from '../solana/wallet';

export function WalletButton() {
  const { installed, address, connecting, connect, disconnect } = useWallet();

  if (address) {
    return (
      <button
        className="wallet-btn connected"
        onClick={disconnect}
        title={`${address}\n(click to disconnect)`}
      >
        👛 {shortAddress(address)}
      </button>
    );
  }

  return (
    <button className="wallet-btn" onClick={connect} disabled={connecting}>
      {connecting ? 'Connecting…' : installed ? '👛 Connect Wallet' : '👛 Get Phantom'}
    </button>
  );
}
