// Client-side transaction builders for the deposit step of a wagered match.
// Unsigned transactions only — signing/sending happens via Phantom through
// useWallet().signAndSendTransaction (src/solana/wallet.tsx), same pattern as
// the coin-burn flow in coin.ts.
import { Connection, PublicKey, Transaction, clusterApiUrl } from '@solana/web3.js';
import { createMatchIx, joinMatchIx, solToLamports } from './escrowProgram';

// The game server's escrow authority — public, fine to embed (it's a pubkey,
// not the secret). Only this address can settle/refund/cancel a match.
export const ESCROW_AUTHORITY_PUBKEY = 'GhZtTz9ziPf2vwGBBZLh8J5ahffGuThMChn8AARTqQY2';

// Public mainnet-beta RPC, not a metered/keyed endpoint — a provider API key
// must never be embedded in client code (it'd be extractable from the
// shipped JS bundle by anyone). The server uses a keyed endpoint privately
// via ESCROW_RPC_URL for its own higher-frequency calls.
const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');

/** Player 1 opens the match and deposits their stake. */
export async function buildCreateMatchTx(opts: {
  matchId: number;
  stakeSol: number;
  player: string;
}): Promise<Transaction> {
  const player = new PublicKey(opts.player);
  const tx = new Transaction().add(
    createMatchIx({
      matchId: opts.matchId,
      stakeLamports: solToLamports(opts.stakeSol),
      authority: new PublicKey(ESCROW_AUTHORITY_PUBKEY),
      player,
    }),
  );
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = player;
  return tx;
}

/** Player 2 joins an already-created match and deposits the matching stake. */
export async function buildJoinMatchTx(opts: {
  matchId: number;
  player: string;
}): Promise<Transaction> {
  const player = new PublicKey(opts.player);
  const tx = new Transaction().add(joinMatchIx({ matchId: opts.matchId, player }));
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = player;
  return tx;
}

/** Wait for the deposit to actually land before telling the server about it —
 * Phantom's signAndSendTransaction returns as soon as it's submitted, not
 * once it's confirmed, so sending 'staked' immediately races the chain. */
export async function confirmDeposit(signature: string): Promise<void> {
  await connection.confirmTransaction(signature, 'confirmed');
}
