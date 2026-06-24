// Wallet connect is paused along with SOL wagering (see RESUME.md) — this
// also means wallet-based account sign-up/login is paused, since that flow
// is triggered by this same Phantom connection. Username/password only for
// now. Kept visible (not removed) so it's clear the feature exists and is
// coming, just not yet — same idea as the "Coming Soon" locks in Lobby/Town.
export function WalletButton() {
  return (
    <div className="wallet-btn-wrap">
      <button className="wallet-btn" disabled title="Wallet connect is coming soon">
        👛 Connect Wallet
      </button>
      <span className="locked-x" aria-hidden="true">
        ✕
      </span>
    </div>
  );
}
