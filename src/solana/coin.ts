// "PokéCoin" — the devnet SPL token burned to buy a Pokémon. See
// create-coin-mint.mts (repo root, gitignored) for how the mint was created.
import {
  Connection,
  PublicKey,
  Transaction,
  clusterApiUrl,
} from '@solana/web3.js';
import {
  createBurnCheckedInstruction,
  getAssociatedTokenAddress,
  getAccount,
  TokenAccountNotFoundError,
} from '@solana/spl-token';

// TODO: replace once create-coin-mint.mts finishes (blocked on devnet faucet
// rate-limit as of this writing — see RESUME.md).
export const COIN_MINT_ADDRESS = 'REPLACE_WITH_MINT_ADDRESS';
export const COIN_DECIMALS = 0;

const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

function mintPubkey(): PublicKey {
  return new PublicKey(COIN_MINT_ADDRESS);
}

/** Current PokéCoin balance for a wallet address (0 if it has none yet). */
export async function getCoinBalance(address: string): Promise<number> {
  try {
    const ata = await getAssociatedTokenAddress(mintPubkey(), new PublicKey(address));
    const account = await getAccount(connection, ata);
    return Number(account.amount);
  } catch (err) {
    if (err instanceof TokenAccountNotFoundError) return 0;
    throw err;
  }
}

/** Build an unsigned transaction that burns `amount` PokéCoin from the
 * player's own token account — burning only needs the owner's signature. */
export async function buildBurnTx(address: string, amount: number): Promise<Transaction> {
  const owner = new PublicKey(address);
  const ata = await getAssociatedTokenAddress(mintPubkey(), owner);
  const tx = new Transaction().add(
    createBurnCheckedInstruction(ata, mintPubkey(), owner, amount, COIN_DECIMALS),
  );
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = owner;
  return tx;
}

const API_URL =
  (import.meta.env.VITE_API_URL as string) ||
  (import.meta.env.DEV ? 'http://localhost:8080' : `${location.protocol}//${location.host}`);

/** Ask the server to mint a reward grant to `wallet` (welcome grant, win
 * reward). The server holds the mint authority; minting needs its signature,
 * not the player's — so this is a plain request, not a wallet transaction. */
export async function claimReward(wallet: string, amount: number): Promise<void> {
  try {
    await fetch(`${API_URL}/api/claim-reward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, amount }),
    });
  } catch {
    // Best-effort — same trust/robustness level as the rest of the app's
    // client-side win tracking. A failed grant doesn't block gameplay.
  }
}
