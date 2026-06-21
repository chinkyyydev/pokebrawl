// Authoritative multiplayer server for Pokémon 1v1.
//
// PIECE 3 — the authoritative battle.
// When two players are paired, the server runs the @pkmn/sim battle itself and
// relays state to both. Clients send only choices ("move 1"); the server alone
// decides outcomes — so nobody can fake damage or results.
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';
import type { PokemonSet } from '@pkmn/sim';
import { BattleController, type SideID } from '../src/game/battle';
import type { BattleStateMsg, ClientMsg, ServerMsg } from '../src/net/protocol';

const PORT = Number(process.env.PORT ?? 8080);

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
  team: PokemonSet[];
  stake: number;
  side?: SideID; // which side of the battle they are (set when matched)
  match?: Match; // the match they're currently in
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

  constructor(
    readonly p1: Client,
    readonly p2: Client,
    readonly stake: number,
  ) {
    p1.side = 'p1';
    p2.side = 'p2';
    p1.match = this;
    p2.match = this;

    // Build the authoritative battle from both teams.
    this.ctrl = new BattleController(p1.team, p2.team, p1.name, p2.name);

    send(p1.ws, { type: 'matchFound', opponentName: p2.name });
    send(p2.ws, { type: 'matchFound', opponentName: p1.name });

    // Send the opening state (turn 1 move selection) to both.
    this.pushState(this.ctrl.drainLog());
  }

  private clientFor(side: SideID): Client {
    return side === 'p1' ? this.p1 : this.p2;
  }

  /** Send each player a fresh snapshot framed from their own point of view. */
  private pushState(lines: string[]): void {
    const winSide = this.ctrl.winnerSide();
    for (const side of ['p1', 'p2'] as const) {
      const me = this.clientFor(side);
      const foeSide: SideID = side === 'p1' ? 'p2' : 'p1';
      const foe = this.clientFor(foeSide);
      const msg: BattleStateMsg = {
        type: 'state',
        stake: this.stake,
        you: { name: me.name, active: this.ctrl.active(side), party: this.ctrl.party(side) },
        foe: { name: foe.name, active: this.ctrl.active(foeSide), party: this.ctrl.party(foeSide) },
        request: this.ctrl.request(side), // only what THIS player may do
        log: lines,
        ended: this.ctrl.ended,
        winner: this.ctrl.ended ? (winSide === side ? 'you' : winSide ? 'foe' : null) : null,
      };
      send(me.ws, msg);
    }
  }

  /** A player submitted a choice for the current turn. */
  onChoice(side: SideID, choice: string): void {
    if (this.ctrl.ended) return;
    if (this.ctrl.request(side).wait) return; // it isn't this side's turn to act
    this.choices[side] = choice;

    // Figure out which sides still owe a choice; only advance when all have acted.
    const needed = (['p1', 'p2'] as const).filter((s) => !this.ctrl.request(s).wait);
    if (!needed.every((s) => this.choices[s] != null)) return;

    // Run the turn on the server. The '' for a waiting side means "no action".
    const res = this.ctrl.makeChoices(this.choices.p1 ?? '', this.choices.p2 ?? '');
    this.choices = {};
    const lines = this.ctrl.drainLog();
    if (!res.ok && res.error) lines.push(`⚠️ ${res.error}`); // bad choice -> let them retry
    this.pushState(lines);
    if (this.ctrl.ended) this.cleanup();
  }

  /** One player left mid-battle: the other wins by forfeit. */
  forfeit(leaver: Client): void {
    const other = leaver === this.p1 ? this.p2 : this.p1;
    send(other.ws, { type: 'opponentLeft' });
    this.cleanup();
  }

  private cleanup(): void {
    this.p1.match = undefined;
    this.p2.match = undefined;
  }
}

// ---------------------------------------------------------------------------
// Matchmaking
// ---------------------------------------------------------------------------
const queues = new Map<number, Client[]>();

function enqueue(client: Client, stake: number, name: string, team: PokemonSet[]): void {
  client.name = name.trim() || 'Trainer';
  client.team = team;
  client.stake = stake;

  const waiting = (queues.get(stake) ?? []).filter(
    (c) => c !== client && c.ws.readyState === WebSocket.OPEN && !c.match,
  );
  const opponent = waiting.shift();

  if (opponent) {
    queues.set(stake, waiting);
    console.log(`🤝 Match: ${opponent.name} vs ${client.name} @ ${stake} SOL`);
    new Match(opponent, client, stake); // creating the match starts the battle
  } else {
    waiting.push(client);
    queues.set(stake, waiting);
    console.log(`⏳ ${client.name} queued @ ${stake} SOL (${waiting.length} waiting)`);
    send(client.ws, { type: 'queued', stake, players: waiting.length });
  }
}

function dequeue(client: Client): void {
  for (const [stake, list] of queues) queues.set(stake, list.filter((c) => c !== client));
}

// HTTP server: serves the built game + answers Render's health check.
const httpServer = createServer(async (req, res) => {
  const { status, type, body } = await serveStatic(req.url ?? '/');
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
});

// WebSocket server shares the same port via an `upgrade` on the HTTP server.
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  const client: Client = { id: randomUUID(), ws, name: '', team: [], stake: 0 };
  console.log(`✅ Player connected — ${wss.clients.size} online`);

  ws.on('message', (data) => {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case 'queue':
        // NOTE: teams are trusted as-is for now. Before mainnet, validate team
        // legality server-side — never trust the client with money on the line.
        if (!Array.isArray(msg.team) || msg.team.length === 0) {
          send(ws, { type: 'error', message: 'You need a team to queue.' });
          return;
        }
        enqueue(client, msg.stake, msg.name, msg.team);
        break;
      case 'choice':
        if (client.side && client.match) client.match.onChoice(client.side, msg.choice);
        break;
      case 'cancel':
        dequeue(client);
        break;
      case 'leave':
        client.match?.forfeit(client);
        dequeue(client);
        break;
    }
  });

  ws.on('close', () => {
    dequeue(client);
    client.match?.forfeit(client);
    console.log(`👋 Player disconnected — ${wss.clients.size} online`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`⚔️  Pokémon 1v1 server listening on port ${PORT} (HTTP + WebSocket)`);
});
