// Client-side transaction builders for the deposit step of a wagered match.
// Unsigned transactions only — signing/sending happens via Phantom through
// useWallet().signAndSendTransaction (src/solana/wallet.tsx), same pattern as
// the coin-burn flow in coin.ts.
import { Connection, PublicKey, Transaction, clusterApiUrl } from '@solana/web3.js';
import { createMatchIx, joinMatchIx, solToLamports } from './escrowProgram';

// The game server's escrow authority — public, fine to embed (it's a pubkey,
// not the secret). Only this address can settle/refund/cancel a match.
export const ESCROW_AUTHORITY_PUBKEY = 'EqByujqS2bREAkUDZGvdGwjBJxkMCFYueU1a9yq6EQpw';

const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

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
