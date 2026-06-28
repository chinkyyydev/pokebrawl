// Client-side transaction builders for the deposit step of a wagered match.
// Unsigned transactions only — signing/sending happens via Phantom through
// useWallet().signAndSendTransaction (src/solana/wallet.tsx), same pattern as
// the coin-burn flow in coin.ts.
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { createMatchIx, joinMatchIx, solToLamports } from './escrowProgram';
import { API_URL } from '../net/client';

// The game server's escrow authority — public, fine to embed (it's a pubkey,
// not the secret). Only this address can settle/refund/cancel a match.
// Override via ESCROW_AUTHORITY_PUBKEY (Node-only, same guard as
// escrowProgram.ts's ESCROW_PROGRAM_ID override) so a devnet test script can
// point at the matching devnet authority instead of mainnet's.
const authorityOverride = typeof process !== 'undefined' ? process.env.ESCROW_AUTHORITY_PUBKEY : undefined;
export const ESCROW_AUTHORITY_PUBKEY = authorityOverride || 'GhZtTz9ziPf2vwGBBZLh8J5ahffGuThMChn8AARTqQY2';

// Routed through our own server's RPC proxy (server/index.ts's
// handleRpcProxy), not Solana's public mainnet-beta endpoint directly — that
// was too unreliable for real transactions ("failed to get recent
// blockhash" in production). The proxy forwards to the server's own private,
// keyed Helius endpoint, which never gets exposed to the browser bundle.
const connection = new Connection(`${API_URL}/api/rpc`, 'confirmed');

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
 * once it's confirmed, so sending 'staked' immediately races the chain.
 *
 * Deliberately NOT connection.confirmTransaction() — it always tries a
 * websocket subscription first and only falls back to polling once that
 * subscription reports 'subscribed'. Our Connection only has an HTTP
 * endpoint (the /api/rpc proxy), so web3.js derives a wss:// URL that has no
 * real server behind it; the subscription attempt never settles, so the
 * polling fallback never even starts, and every deposit silently ate the
 * *entire* timeout (measured: real ~3-4 min waits for a transaction that
 * actually finalized in a few seconds). Polling getSignatureStatus directly
 * sidesteps that broken subscription path entirely. */
export async function confirmDeposit(signature: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  const pollMs = 1_500;
  while (Date.now() < deadline) {
    const { value } = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
    if (value) {
      if (value.err) throw new Error(`Deposit transaction failed: ${JSON.stringify(value.err)}`);
      if (value.confirmationStatus === 'confirmed' || value.confirmationStatus === 'finalized') return;
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error('Deposit did not confirm in time — check your wallet before retrying.');
}
