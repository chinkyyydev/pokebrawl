// Shared (client + server) encoding for the pokebrawl-escrow Anchor program
// (programs/pokebrawl-escrow/src/lib.rs). Hand-rolled instead of going
// through @coral-xyz/anchor + the auto-generated IDL — Anchor's instruction
// and account discriminators are just a documented, deterministic hash
// (sha256("global:<ix_name>") / sha256("account:<Type>"), first 8 bytes), so
// there's nothing the IDL gives us here that we can't compute directly. This
// also means the client/server code doesn't have to wait on Playground's
// generated IDL JSON — only the deployed Program ID.
//
// Isomorphic on purpose (no `fetch`/`localStorage`/Node-only APIs) — the
// server imports this module directly, same lesson as src/state/storage.ts.
import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { sha256 } from '@noble/hashes/sha2.js';

// Deployed to mainnet-beta (built + deployed locally via cargo-build-sbf +
// solana CLI, see RESUME.md). The devnet deployment (now superseded as the
// primary target) was ALuiT5kBFx4ftHPi6Uo2zUwJadMLU31ouifbCVLMpPXv.
export const ESCROW_PROGRAM_ID = '5eXLrUexRtKcpJPP6jf6dntKZoueq6F9SzkycBdGxWCq';

export function programId(): PublicKey {
  return new PublicKey(ESCROW_PROGRAM_ID);
}

function discriminator(namespace: 'global' | 'account', name: string): Buffer {
  return Buffer.from(sha256(Buffer.from(`${namespace}:${name}`, 'utf8'))).subarray(0, 8);
}

function u64le(value: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(value));
  return buf;
}

/** The `["match", match_id_le_bytes]` PDA every instruction operates on. */
export function matchPda(matchId: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('match'), u64le(matchId)], programId());
}

/** A `number` is safe here — devnet/mainnet lamport stakes and match ids both
 * stay well under Number.MAX_SAFE_INTEGER (2^53), so no BigInt threading
 * through the rest of the app. */
export function randomMatchId(): number {
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}

export function createMatchIx(opts: {
  matchId: number;
  stakeLamports: number;
  authority: PublicKey;
  player: PublicKey;
}): TransactionInstruction {
  const [match] = matchPda(opts.matchId);
  const data = Buffer.concat([
    discriminator('global', 'create_match'),
    u64le(opts.matchId),
    u64le(opts.stakeLamports),
    opts.authority.toBuffer(),
  ]);
  return new TransactionInstruction({
    programId: programId(),
    keys: [
      { pubkey: match, isSigner: false, isWritable: true },
      { pubkey: opts.player, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function joinMatchIx(opts: { matchId: number; player: PublicKey }): TransactionInstruction {
  const [match] = matchPda(opts.matchId);
  return new TransactionInstruction({
    programId: programId(),
    keys: [
      { pubkey: match, isSigner: false, isWritable: true },
      { pubkey: opts.player, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: discriminator('global', 'join_match'),
  });
}

export function settleIx(opts: {
  matchId: number;
  authority: PublicKey;
  winner: PublicKey;
}): TransactionInstruction {
  const [match] = matchPda(opts.matchId);
  return new TransactionInstruction({
    programId: programId(),
    keys: [
      { pubkey: match, isSigner: false, isWritable: true },
      { pubkey: opts.authority, isSigner: true, isWritable: false },
      { pubkey: opts.winner, isSigner: false, isWritable: true },
    ],
    data: discriminator('global', 'settle'),
  });
}

export function refundIx(opts: {
  matchId: number;
  authority: PublicKey;
  player1: PublicKey;
  player2: PublicKey;
}): TransactionInstruction {
  const [match] = matchPda(opts.matchId);
  return new TransactionInstruction({
    programId: programId(),
    keys: [
      { pubkey: match, isSigner: false, isWritable: true },
      { pubkey: opts.authority, isSigner: true, isWritable: false },
      { pubkey: opts.player1, isSigner: false, isWritable: true },
      { pubkey: opts.player2, isSigner: false, isWritable: true },
    ],
    data: discriminator('global', 'refund'),
  });
}

export function cancelIx(opts: {
  matchId: number;
  signer: PublicKey;
  player1: PublicKey;
}): TransactionInstruction {
  const [match] = matchPda(opts.matchId);
  return new TransactionInstruction({
    programId: programId(),
    keys: [
      { pubkey: match, isSigner: false, isWritable: true },
      { pubkey: opts.signer, isSigner: true, isWritable: false },
      { pubkey: opts.player1, isSigner: false, isWritable: true },
    ],
    data: discriminator('global', 'cancel'),
  });
}

export interface MatchAccount {
  matchId: number;
  stakeLamports: number;
  authority: PublicKey;
  player1: PublicKey;
  player2: PublicKey;
  settled: boolean;
  bump: number;
}

const ACCOUNT_DISCRIMINATOR_LEN = 8;

/** Decode the raw `Match` account (see the Rust `#[account]` struct) —
 * field order/sizes must match `lib.rs` exactly: match_id(u64) stake(u64)
 * authority(32) player1(32) player2(32) settled(bool) bump(u8). */
export function decodeMatchAccount(data: Buffer): MatchAccount {
  let o = ACCOUNT_DISCRIMINATOR_LEN;
  const matchId = Number(data.readBigUInt64LE(o));
  o += 8;
  const stakeLamports = Number(data.readBigUInt64LE(o));
  o += 8;
  const authority = new PublicKey(data.subarray(o, o + 32));
  o += 32;
  const player1 = new PublicKey(data.subarray(o, o + 32));
  o += 32;
  const player2 = new PublicKey(data.subarray(o, o + 32));
  o += 32;
  const settled = data.readUInt8(o) === 1;
  o += 1;
  const bump = data.readUInt8(o);
  return { matchId, stakeLamports, authority, player1, player2, settled, bump };
}

export const SYSTEM_PROGRAM_DEFAULT = PublicKey.default; // Pubkey::default() in Rust = all-zero

const LAMPORTS_PER_SOL = 1_000_000_000;
export function solToLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}
