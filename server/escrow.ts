// Server-side glue for the deployed pokebrawl-escrow program (devnet). The
// server holds the escrow "authority" keypair and is the only signer allowed
// to settle/refund/cancel a match — see programs/pokebrawl-escrow/src/lib.rs.
// Only active once ESCROW_AUTHORITY_SECRET is set (same on/off pattern as
// COIN_MINT_SECRET in index.ts).
import { Connection, Keypair, PublicKey, Transaction, clusterApiUrl, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  cancelIx,
  decodeMatchAccount,
  matchPda,
  refundIx,
  settleIx,
  type MatchAccount,
} from '../src/solana/escrowProgram';

const connection = new Connection(process.env.ESCROW_RPC_URL ?? clusterApiUrl('devnet'), 'confirmed');

export const escrowAuthority = process.env.ESCROW_AUTHORITY_SECRET
  ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.ESCROW_AUTHORITY_SECRET)))
  : null;

/** Read the on-chain match PDA, or null if it doesn't exist (not created yet). */
export async function getMatch(matchId: number): Promise<MatchAccount | null> {
  const [pda] = matchPda(matchId);
  const info = await connection.getAccountInfo(pda, 'confirmed');
  return info ? decodeMatchAccount(info.data) : null;
}

/** Never trust the client's say-so that they deposited — read the match PDA
 * straight from the chain. Both create_match and join_match transfer the
 * stake and set player1/player2 atomically in the same instruction, so a
 * non-default player2 is proof both deposits landed. */
export async function verifyMatchFunded(
  matchId: number,
  expectedStakeLamports: number,
): Promise<boolean> {
  const m = await getMatch(matchId);
  if (!m) return false;
  return (
    !m.settled &&
    m.stakeLamports === expectedStakeLamports &&
    !m.player2.equals(PublicKey.default)
  );
}

async function sign(ix: Parameters<typeof Transaction.prototype.add>[0]): Promise<string> {
  if (!escrowAuthority) throw new Error('Escrow authority not configured');
  const tx = new Transaction().add(ix);
  return sendAndConfirmTransaction(connection, tx, [escrowAuthority], { commitment: 'confirmed' });
}

/** Pay the full pot to the winner once the real battle (already decided by
 * the authoritative @pkmn/sim simulation) has a result. */
export async function settleMatch(matchId: number, winner: string): Promise<string> {
  if (!escrowAuthority) throw new Error('Escrow authority not configured');
  return sign(
    settleIx({ matchId, authority: escrowAuthority.publicKey, winner: new PublicKey(winner) }),
  );
}

/** Refund both players (e.g. a draw, or aborted match after both deposited). */
export async function refundMatch(matchId: number, player1: string, player2: string): Promise<string> {
  if (!escrowAuthority) throw new Error('Escrow authority not configured');
  return sign(
    refundIx({
      matchId,
      authority: escrowAuthority.publicKey,
      player1: new PublicKey(player1),
      player2: new PublicKey(player2),
    }),
  );
}

/** Cancel a match nobody joined (deposit timeout); refunds player 1. */
export async function cancelMatch(matchId: number, player1: string): Promise<string> {
  if (!escrowAuthority) throw new Error('Escrow authority not configured');
  return sign(
    cancelIx({ matchId, signer: escrowAuthority.publicKey, player1: new PublicKey(player1) }),
  );
}
