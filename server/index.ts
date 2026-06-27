// Authoritative multiplayer server for Pokémon 1v1.
//
// PIECE 3 — the authoritative battle.
// When two players are paired, the server runs the @pkmn/sim battle itself and
// relays state to both. Clients send only choices ("move 1"); the server alone
// decides outcomes — so nobody can fake damage or results.
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';
import type { PokemonSet } from '@pkmn/sim';
import { Connection, Keypair, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import { BattleController, type SideID } from '../src/game/battle';
import { chooseTopMove } from '../src/game/ai';
import { teamBanViolation } from '../src/data/bans';
import { createProfile } from '../src/state/storage';
import type { BattleStateMsg, ClientMsg, ServerMsg } from '../src/net/protocol';
import {
  authFromHeader,
  clientIp,
  hashPassword,
  MAX_ACCOUNTS_PER_IP,
  passwordError,
  signToken,
  usernameError,
  verifyPassword,
  verifyToken,
} from './auth';
import { countByIp, createAccount, findById, findByUsername, findByWallet, saveProfile } from './db';
import { cancelMatch, getMatch, refundMatch, settleMatch, verifyMatchFunded } from './escrow';
import { randomMatchId, solToLamports } from '../src/solana/escrowProgram';

const PORT = Number(process.env.PORT ?? 8080);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    return {};
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS });
  res.end(JSON.stringify(body));
}

// ---------------------------------------------------------------------------
// Accounts: sign-up (password or wallet), login, and the account's saved
// Profile (the new home for what src/state/storage.ts's localStorage
// load/saveProfile used to do — see server/db.ts and server/auth.ts).
// ---------------------------------------------------------------------------

async function handleSignup(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const username = body.username;
  const password = body.password as string | undefined;
  const wallet = body.wallet as string | undefined;

  const usernameProblem = usernameError(username);
  if (usernameProblem) return sendJson(res, 400, { error: usernameProblem });
  if (!password && !wallet) return sendJson(res, 400, { error: 'Password or wallet required.' });
  if (password) {
    const pwProblem = passwordError(password);
    if (pwProblem) return sendJson(res, 400, { error: pwProblem });
  }

  if (await findByUsername(username as string)) {
    return sendJson(res, 409, { error: 'That username is already taken.' });
  }
  if (wallet && (await findByWallet(wallet))) {
    return sendJson(res, 409, { error: 'That wallet already has an account.' });
  }

  const ip = clientIp(req);
  if ((await countByIp(ip)) >= MAX_ACCOUNTS_PER_IP) {
    return sendJson(res, 429, {
      error: `Limit of ${MAX_ACCOUNTS_PER_IP} accounts per network reached.`,
    });
  }

  const account = await createAccount({
    username: username as string,
    passwordHash: password ? await hashPassword(password) : null,
    walletAddress: wallet ?? null,
    signupIp: ip,
    profile: createProfile(username as string, 'red'),
  });
  const token = signToken({ accountId: account.id, username: account.username });
  sendJson(res, 200, { token, profile: account.profile });
}

async function handleLogin(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const { username, password } = body as { username?: string; password?: string };
  if (!username || !password) return sendJson(res, 400, { error: 'Username and password required.' });

  const account = await findByUsername(username);
  if (!account?.password_hash || !(await verifyPassword(password, account.password_hash))) {
    return sendJson(res, 401, { error: 'Incorrect username or password.' });
  }
  const token = signToken({ accountId: account.id, username: account.username });
  sendJson(res, 200, { token, profile: account.profile });
}

async function handleWalletLogin(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const wallet = body.wallet as string | undefined;
  if (!wallet) return sendJson(res, 400, { error: 'Wallet required.' });

  const account = await findByWallet(wallet);
  if (!account) return sendJson(res, 200, { needsUsername: true });

  const token = signToken({ accountId: account.id, username: account.username });
  sendJson(res, 200, { token, profile: account.profile });
}

async function handleGetProfile(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const auth = authFromHeader(req);
  if (!auth) return sendJson(res, 401, { error: 'Not logged in.' });
  const account = await findById(auth.accountId);
  if (!account) return sendJson(res, 404, { error: 'Account not found.' });
  sendJson(res, 200, { profile: account.profile });
}

async function handlePutProfile(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const auth = authFromHeader(req);
  if (!auth) return sendJson(res, 401, { error: 'Not logged in.' });
  const body = await readJsonBody(req);
  if (!body.profile || typeof body.profile !== 'object') {
    return sendJson(res, 400, { error: 'Missing profile.' });
  }
  await saveProfile(auth.accountId, body.profile as never);
  sendJson(res, 200, { ok: true });
}

// PokéCoin reward minting (welcome grant, per-win reward). Only active once
// COIN_MINT_SECRET/COIN_MINT_ADDRESS are set — see create-coin-mint.mts.
const coinConnection = new Connection(clusterApiUrl('devnet'), 'confirmed');
const coinAuthority = process.env.COIN_MINT_SECRET
  ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.COIN_MINT_SECRET)))
  : null;
const coinMint = process.env.COIN_MINT_ADDRESS ? new PublicKey(process.env.COIN_MINT_ADDRESS) : null;

async function handleClaimReward(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!coinAuthority || !coinMint) {
    return sendJson(res, 503, { ok: false, error: 'Coin not configured yet' });
  }
  try {
    const { wallet, amount } = await readJsonBody(req);
    if (typeof wallet !== 'string' || !wallet || typeof amount !== 'number' || amount <= 0) {
      return sendJson(res, 400, { ok: false, error: 'Invalid wallet/amount' });
    }
    const owner = new PublicKey(wallet);
    const ata = await getOrCreateAssociatedTokenAccount(
      coinConnection,
      coinAuthority,
      coinMint,
      owner,
    );
    const signature = await mintTo(
      coinConnection,
      coinAuthority,
      coinMint,
      ata.address,
      coinAuthority,
      Math.floor(amount),
    );
    sendJson(res, 200, { ok: true, signature });
  } catch (err) {
    console.error('claim-reward failed:', err);
    sendJson(res, 500, { ok: false, error: 'Mint failed' });
  }
}

// Pokémon Champions-style clock: one visible 45s timer per turn, backed by a
// 7-minute total match clock per player (like a chess clock). Whichever runs
// out first decides the turn (auto-pick) or the match (instant loss).
const TURN_MS = 45_000;
const MATCH_CLOCK_MS = 7 * 60_000;

// In production this same service also serves the built game (Vite's dist/).
const DIST = join(import.meta.dirname, '..', 'dist');
const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

async function serveStatic(urlPath: string): Promise<{ status: number; type: string; body: Buffer | string }> {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  // Resolve safely inside DIST; fall back to index.html for SPA routes.
  let file = normalize(join(DIST, rel));
  if (!file.startsWith(DIST)) return { status: 403, type: 'text/plain', body: 'Forbidden' };
  try {
    const body = await readFile(file);
    const ext = rel.slice(rel.lastIndexOf('.'));
    return { status: 200, type: MIME[ext] ?? 'application/octet-stream', body };
  } catch {
    try {
      const body = await readFile(join(DIST, 'index.html'));
      return { status: 200, type: 'text/html', body };
    } catch {
      return { status: 404, type: 'text/plain', body: 'Not found' };
    }
  }
}

interface Client {
  id: string;
  ws: WebSocket;
  name: string;
  wallet: string; // Solana address — identity for staking/payouts
  team: PokemonSet[];
  stake: number;
  side?: SideID; // which side of the battle they are (set when matched)
  match?: Match; // the match they're currently in
  pendingMatchId?: number; // set while waiting on an on-chain deposit (stake > 0)
}

function send(ws: WebSocket, msg: ServerMsg): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

// ---------------------------------------------------------------------------
// A single running battle between two players.
// ---------------------------------------------------------------------------
class Match {
  readonly ctrl: BattleController;
  // Choices submitted so far this turn, keyed by side.
  private choices: { p1?: string; p2?: string } = {};
  // Remaining match clock per side, like a chess clock — only the time a
  // side actually spends deciding counts against it.
  private clock: Record<SideID, number> = { p1: MATCH_CLOCK_MS, p2: MATCH_CLOCK_MS };
  private turnStartedAt = 0;
  private timers: Partial<Record<SideID, ReturnType<typeof setTimeout>>> = {};
  private over = false;

  constructor(
    readonly p1: Client,
    readonly p2: Client,
    readonly stake: number,
    readonly matchId: number = 0,
    notifyMatchFound = true,
  ) {
    p1.side = 'p1';
    p2.side = 'p2';
    p1.match = this;
    p2.match = this;

    // Build the authoritative battle from both teams.
    this.ctrl = new BattleController(p1.team, p2.team, p1.name, p2.name);

    // For a staked match this was already sent once (telling each side to
    // deposit) — don't resend it; 'stakeConfirmed' was the signal that the
    // battle is starting. Free play (matchId 0) sends it here, same as before.
    if (notifyMatchFound) {
      send(p1.ws, { type: 'matchFound', opponentName: p2.name, opponentWallet: p2.wallet, matchId, isCreator: false });
      send(p2.ws, { type: 'matchFound', opponentName: p1.name, opponentWallet: p1.wallet, matchId, isCreator: false });
    }

    // Send the opening state (turn 1 move selection) to both, then start the clock.
    this.pushState(this.ctrl.drainLog());
    this.startTimers();
  }

  /** Pay the on-chain pot to the winner (stake === 0 is free play, no escrow). */
  private settleStake(winner: Client | null): void {
    if (this.stake <= 0 || !this.matchId) return;
    if (winner) {
      settleMatch(this.matchId, winner.wallet).catch((err) =>
        console.error(`settle ${this.matchId} failed:`, err),
      );
    } else {
      refundMatch(this.matchId, this.p1.wallet, this.p2.wallet).catch((err) =>
        console.error(`refund ${this.matchId} failed:`, err),
      );
    }
  }

  private clientFor(side: SideID): Client {
    return side === 'p1' ? this.p1 : this.p2;
  }

  /** Send each player a fresh snapshot framed from their own point of view. */
  private pushState(lines: string[]): void {
    const winSide = this.ctrl.winnerSide();
    const pendingSides = this.pending();
    for (const side of ['p1', 'p2'] as const) {
      const me = this.clientFor(side);
      const foeSide: SideID = side === 'p1' ? 'p2' : 'p1';
      const foe = this.clientFor(foeSide);
      const stillPending = !this.ctrl.ended && pendingSides.includes(side);
      const msg: BattleStateMsg = {
        type: 'state',
        stake: this.stake,
        you: { name: me.name, active: this.ctrl.active(side), party: this.ctrl.party(side) },
        foe: { name: foe.name, active: this.ctrl.active(foeSide), party: this.ctrl.party(foeSide) },
        request: this.ctrl.request(side), // only what THIS player may do
        log: lines,
        ended: this.ctrl.ended,
        winner: this.ctrl.ended ? (winSide === side ? 'you' : winSide ? 'foe' : null) : null,
        turnDeadline: stillPending ? this.turnStartedAt + Math.min(TURN_MS, this.clock[side]) : null,
        clockMs: { you: this.clock[side], foe: this.clock[foeSide] },
      };
      send(me.ws, msg);
    }
  }

  /** Sides that must act this decision point but haven't chosen yet. */
  private pending(): SideID[] {
    return (['p1', 'p2'] as const).filter(
      (s) => !this.ctrl.request(s).wait && this.choices[s] == null,
    );
  }

  /** A player submitted a choice for the current turn. */
  onChoice(side: SideID, choice: string): void {
    if (this.over || this.ctrl.ended) return;
    if (this.ctrl.request(side).wait) return; // it isn't this side's turn to act
    if (this.choices[side] != null) return; // already acted this turn
    this.spendClock(side);
    if (this.clock[side] <= 0) return this.timeUp(side); // clock ran out right as they chose
    this.clearTimer(side);
    this.choices[side] = choice;
    if (this.pending().length === 0) this.resolveTurn(); // everyone has acted
  }

  /** Commit the collected choices, advance the battle, and re-arm the clock. */
  private resolveTurn(): void {
    this.clearTimers();
    const res = this.ctrl.makeChoices(this.choices.p1 ?? '', this.choices.p2 ?? '');
    this.choices = {};
    const lines = this.ctrl.drainLog();
    if (!res.ok && res.error) lines.push(`⚠️ ${res.error}`); // bad choice -> let them retry
    this.pushState(lines);
    if (this.ctrl.ended) {
      const winSide = this.ctrl.winnerSide();
      this.settleStake(winSide ? this.clientFor(winSide) : null);
      this.cleanup();
    } else this.startTimers(); // next decision point
  }

  // ---- Turn clock (Pokémon Champions style: 45s/turn, 7min/match) ----
  private startTimers(): void {
    this.clearTimers();
    this.turnStartedAt = Date.now();
    for (const side of this.pending()) {
      const ms = Math.min(TURN_MS, this.clock[side]);
      this.timers[side] = setTimeout(() => this.onTimeout(side), ms);
    }
  }

  /** A side's timer fired: spend whatever time they had, then act for them. */
  private onTimeout(side: SideID): void {
    if (this.over || this.ctrl.ended) return;
    if (this.choices[side] != null) return; // shouldn't happen — kept as a guard
    this.timers[side] = undefined;
    this.spendClock(side);
    if (this.clock[side] <= 0) return this.timeUp(side); // out of match clock: instant loss
    this.choices[side] = chooseTopMove(this.ctrl, side); // top-listed option, not a smart pick
    if (this.pending().length === 0) this.resolveTurn();
  }

  /** Deduct the time this side just spent deciding from their match clock. */
  private spendClock(side: SideID): void {
    const spent = Date.now() - this.turnStartedAt;
    this.clock[side] = Math.max(0, this.clock[side] - spent);
  }

  private clearTimer(side: SideID): void {
    const t = this.timers[side];
    if (t) clearTimeout(t);
    this.timers[side] = undefined;
  }

  private clearTimers(): void {
    this.clearTimer('p1');
    this.clearTimer('p2');
  }

  /** A side's 7-minute match clock hit zero: instant loss, match over. */
  private timeUp(side: SideID): void {
    if (this.over) return;
    const loser = this.clientFor(side);
    const winner = side === 'p1' ? this.p2 : this.p1;
    send(loser.ws, { type: 'timeUp', youWon: false });
    send(winner.ws, { type: 'timeUp', youWon: true });
    this.settleStake(winner);
    this.cleanup();
  }

  /** One player left mid-battle: the other wins by forfeit. */
  forfeit(leaver: Client): void {
    if (this.over) return;
    const other = leaver === this.p1 ? this.p2 : this.p1;
    send(other.ws, { type: 'opponentLeft' });
    this.settleStake(other);
    this.cleanup();
  }

  private cleanup(): void {
    this.over = true;
    this.clearTimers();
    this.p1.match = undefined;
    this.p2.match = undefined;
  }
}

// ---------------------------------------------------------------------------
// Matchmaking
// ---------------------------------------------------------------------------
const queues = new Map<number, Client[]>();

// A pairing at stake > 0 doesn't start the battle immediately — both sides
// must deposit on-chain first. The creator deposits (create_match) before the
// joiner can (join_match requires the match PDA to already exist), so this
// is sequential, not parallel.
interface PendingDeposit {
  matchId: number;
  stake: number; // SOL
  creator: Client;
  joiner: Client;
  creatorStaked: boolean;
  joinerStaked: boolean;
  timeout: ReturnType<typeof setTimeout>;
}
const pendingDeposits = new Map<number, PendingDeposit>();
const DEPOSIT_TIMEOUT_MS = 60_000;

function enqueue(
  client: Client,
  stake: number,
  name: string,
  wallet: string,
  team: PokemonSet[],
): void {
  client.name = name;
  client.wallet = wallet;
  client.team = team;
  client.stake = stake;

  const waiting = (queues.get(stake) ?? []).filter(
    (c) => c !== client && c.ws.readyState === WebSocket.OPEN && !c.match,
  );
  const opponent = waiting.shift();

  if (!opponent) {
    waiting.push(client);
    queues.set(stake, waiting);
    console.log(`⏳ ${client.name} queued @ ${stake} SOL (${waiting.length} waiting)`);
    send(client.ws, { type: 'queued', stake, players: waiting.length });
    return;
  }
  queues.set(stake, waiting);

  if (stake <= 0) {
    console.log(`🤝 Match: ${opponent.name} vs ${client.name} @ free play`);
    new Match(opponent, client, 0); // free play never touches the chain
    return;
  }

  const matchId = randomMatchId();
  console.log(`🤝 Paired: ${opponent.name} vs ${client.name} @ ${stake} SOL — awaiting deposits (match ${matchId})`);
  opponent.pendingMatchId = matchId;
  client.pendingMatchId = matchId;
  pendingDeposits.set(matchId, {
    matchId,
    stake,
    creator: opponent,
    joiner: client,
    creatorStaked: false,
    joinerStaked: false,
    timeout: setTimeout(() => failDeposit(matchId, 'Deposit window expired.'), DEPOSIT_TIMEOUT_MS),
  });
  send(opponent.ws, { type: 'matchFound', opponentName: client.name, opponentWallet: client.wallet, matchId, isCreator: true });
  send(client.ws, { type: 'matchFound', opponentName: opponent.name, opponentWallet: opponent.wallet, matchId, isCreator: false });
}

function dequeue(client: Client): void {
  for (const [stake, list] of queues) queues.set(stake, list.filter((c) => c !== client));
}

/** The client's own RPC may see a deposit confirm slightly before the
 * server's does (different endpoints, brief replication lag) — retry for a
 * few seconds rather than failing a real deposit on a single stale read. */
async function retryUntil<T>(
  check: () => Promise<T | null>,
  attempts = 5,
  delayMs = 1200,
): Promise<T | null> {
  for (let i = 0; i < attempts; i++) {
    const result = await check().catch(() => null);
    if (result) return result;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

/** A client confirmed (client-side) that their deposit transaction landed.
 * Never trust that alone — re-derive everything from the chain. */
async function handleStaked(client: Client, matchId: number): Promise<void> {
  const pending = pendingDeposits.get(matchId);
  if (!pending || (client !== pending.creator && client !== pending.joiner)) {
    send(client.ws, { type: 'stakeFailed', message: 'Match expired — return to the lobby.' });
    return;
  }

  const expectedLamports = solToLamports(pending.stake);

  if (client === pending.creator) {
    const onChain = await retryUntil(async () => {
      const m = await getMatch(matchId);
      return m && m.player1.toBase58() === client.wallet && m.stakeLamports === expectedLamports ? m : null;
    });
    if (!onChain) {
      send(client.ws, { type: 'stakeFailed', message: 'Deposit not found on-chain yet — try again.' });
      return;
    }
    pending.creatorStaked = true;
    send(pending.joiner.ws, { type: 'opponentStaked' }); // safe to join now — the PDA exists
    return;
  }

  // Joiner: the creator must already be confirmed (so the PDA exists).
  if (!pending.creatorStaked) {
    send(client.ws, { type: 'stakeFailed', message: 'Waiting on the other player’s deposit.' });
    return;
  }
  const onChain = await retryUntil(async () => {
    const funded = await verifyMatchFunded(matchId, expectedLamports);
    if (!funded) return null;
    const m = await getMatch(matchId);
    return m && m.player2.toBase58() === client.wallet ? m : null;
  });
  if (!onChain) {
    send(client.ws, { type: 'stakeFailed', message: 'Deposit not found on-chain yet — try again.' });
    return;
  }
  pending.joinerStaked = true;

  clearTimeout(pending.timeout);
  pendingDeposits.delete(matchId);
  pending.creator.pendingMatchId = undefined;
  pending.joiner.pendingMatchId = undefined;
  send(pending.creator.ws, { type: 'stakeConfirmed' });
  send(pending.joiner.ws, { type: 'stakeConfirmed' });
  console.log(`✅ Both deposits confirmed for match ${matchId} — starting battle`);
  new Match(pending.creator, pending.joiner, pending.stake, matchId, false);
}

/** Deposit window expired, or a player bailed before both sides staked.
 * Best-effort on-chain cleanup — nobody but the creator has money at risk
 * unless the joiner also deposited, and devnet rent is cheap either way. */
function failDeposit(matchId: number, message: string): void {
  const pending = pendingDeposits.get(matchId);
  if (!pending) return;
  clearTimeout(pending.timeout);
  pendingDeposits.delete(matchId);
  pending.creator.pendingMatchId = undefined;
  pending.joiner.pendingMatchId = undefined;
  send(pending.creator.ws, { type: 'stakeFailed', message });
  send(pending.joiner.ws, { type: 'stakeFailed', message });

  if (pending.creatorStaked && pending.joinerStaked) {
    refundMatch(matchId, pending.creator.wallet, pending.joiner.wallet).catch((err) =>
      console.error(`refund ${matchId} failed:`, err),
    );
  } else if (pending.creatorStaked) {
    cancelMatch(matchId, pending.creator.wallet).catch((err) =>
      console.error(`cancel ${matchId} failed:`, err),
    );
  }
}

// HTTP server: serves the built game, the account + coin-reward APIs, and
// answers Render's health check.
const httpServer = createServer(async (req, res) => {
  if (req.url?.startsWith('/api/')) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS);
      res.end();
      return;
    }
    try {
      switch (req.url) {
        case '/api/claim-reward':
          return void (await handleClaimReward(req, res));
        case '/api/signup':
          return void (await handleSignup(req, res));
        case '/api/login':
          return void (await handleLogin(req, res));
        case '/api/wallet-login':
          return void (await handleWalletLogin(req, res));
        case '/api/profile':
          if (req.method === 'PUT') return void (await handlePutProfile(req, res));
          return void (await handleGetProfile(req, res));
        default:
          return sendJson(res, 404, { error: 'Not found' });
      }
    } catch (err) {
      // A DB hiccup (e.g. DATABASE_URL unset/unreachable) shouldn't hang the
      // request forever — always send *something* back.
      console.error(`${req.url} failed:`, err);
      return sendJson(res, 500, { error: 'Server error. Try again shortly.' });
    }
  }
  const { status, type, body } = await serveStatic(req.url ?? '/');
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
});

// WebSocket server shares the same port via an `upgrade` on the HTTP server.
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  const client: Client = { id: randomUUID(), ws, name: '', wallet: '', team: [], stake: 0 };
  console.log(`✅ Player connected — ${wss.clients.size} online`);

  ws.on('message', (data) => {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case 'staked':
        handleStaked(client, msg.matchId).catch((err) => console.error('staked handler failed:', err));
        break;
      case 'queue': {
        // Identity comes from the verified session token, never from the
        // client-sent payload — same "never trust the client" principle as
        // the team-legality check below, just applied to who you're allowed
        // to claim to be in a match.
        const auth = verifyToken(msg.token);
        if (!auth) {
          send(ws, { type: 'error', message: 'Please log in again.' });
          return;
        }
        // Teams are validated server-side — never trust the client with money on
        // the line. (Full legality validation — move legality, EV/IV limits — is
        // still TODO before mainnet; this enforces the competitive ban list.)
        if (!Array.isArray(msg.team) || msg.team.length === 0) {
          send(ws, { type: 'error', message: 'You need a team to queue.' });
          return;
        }
        const banned = teamBanViolation(msg.team);
        if (banned) {
          send(ws, { type: 'error', message: `Illegal team: ${banned}.` });
          return;
        }
        enqueue(client, msg.stake, auth.username, msg.wallet ?? '', msg.team);
        break;
      }
      case 'choice':
        if (client.side && client.match) client.match.onChoice(client.side, msg.choice);
        break;
      case 'cancel':
        dequeue(client);
        if (client.pendingMatchId != null) failDeposit(client.pendingMatchId, 'Your opponent left.');
        break;
      case 'leave':
        client.match?.forfeit(client);
        dequeue(client);
        if (client.pendingMatchId != null) failDeposit(client.pendingMatchId, 'Your opponent left.');
        break;
    }
  });

  ws.on('close', () => {
    dequeue(client);
    client.match?.forfeit(client);
    if (client.pendingMatchId != null) failDeposit(client.pendingMatchId, 'Your opponent disconnected.');
    console.log(`👋 Player disconnected — ${wss.clients.size} online`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`⚔️  Pokémon 1v1 server listening on port ${PORT} (HTTP + WebSocket)`);
});
