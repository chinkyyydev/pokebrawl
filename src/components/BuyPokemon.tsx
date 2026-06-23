import { useEffect, useState } from 'react';
import type { SpeciesLite } from '../data/pokedex';
import { sampleSpecies } from '../game/randomTeam';
import { buildBurnTx, getCoinBalance } from '../solana/coin';
import { useWallet } from '../solana/wallet';
import { BUY_COST } from '../state/storage';
import type { TeamMember } from '../types';
import { PokemonPicker } from './PokemonPicker';
import { DialogBox } from './DialogBox';

export function BuyPokemon({
  collection,
  onBought,
  onBack,
}: {
  collection: TeamMember[];
  onBought: (species: string) => void;
  onBack: () => void;
}) {
  const { address, connect, connecting, signAndSendTransaction } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [options, setOptions] = useState<SpeciesLite[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    getCoinBalance(address).then((b) => {
      if (!cancelled) setBalance(b);
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

  async function buy() {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      const tx = await buildBurnTx(address, BUY_COST);
      await signAndSendTransaction(tx);
      setOptions(sampleSpecies(9, collection.map((m) => m.species)));
      setBalance((b) => (b ?? 0) - BUY_COST);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed.');
    } finally {
      setBusy(false);
    }
  }

  function pick(s: SpeciesLite) {
    onBought(s.name);
    setOptions(null);
  }

  return (
    <div className="scene buy-pokemon-scene">
      <DialogBox speaker="SHOP">
        {options
          ? 'Pick your new Pokémon!'
          : 'Buy coin using $Pokebrawl, then spend it for a choice of 9 random Pokémon.'}
      </DialogBox>

      {!address ? (
        <button className="press-start" disabled={connecting} onClick={connect}>
          {connecting ? 'Connecting…' : 'Connect wallet to buy ▶'}
        </button>
      ) : options ? (
        <PokemonPicker onPick={pick} pool={options} searchable={false} />
      ) : (
        <div className="buy-panel">
          <p className="balance">Balance: {balance ?? '…'} $Pokebrawl</p>
          {error && <p className="error">{error}</p>}
          <button
            className="press-start"
            disabled={busy || balance === null || balance < BUY_COST}
            onClick={buy}
          >
            {busy ? 'Buying…' : `Buy for ${BUY_COST} $Pokebrawl ▶`}
          </button>
        </div>
      )}

      <button className="link-btn" onClick={onBack}>
        Back to town
      </button>
    </div>
  );
}
