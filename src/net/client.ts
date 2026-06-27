import type { ClientMsg, ServerMsg } from './protocol';

// `import.meta.env` is a Vite-only global — undefined when this module gets
// loaded outside Vite (e.g. the gitignored *.mts test scripts run directly
// via tsx). Guarded so those scripts can still import anything that pulls in
// this module (like src/solana/escrow.ts) without crashing.
const env = (import.meta as { env?: Record<string, string | boolean | undefined> }).env;
const isBrowser = typeof location !== 'undefined';

// Where the browser connects:
//  - explicit override via VITE_WS_URL (if you ever split client/server hosts)
//  - local dev (or a plain Node/tsx script, e.g. a test): the separate
//    `npm run server` process on :8080
//  - production: same origin as the page (our Render service serves both)
export const WS_URL =
  (env?.VITE_WS_URL as string) ||
  (!isBrowser || env?.DEV
    ? 'ws://localhost:8080'
    : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);

/** Same origin logic as WS_URL, but for plain HTTP API calls (auth, coin, escrow RPC proxy). */
export const API_URL =
  (env?.VITE_API_URL as string) ||
  (!isBrowser || env?.DEV ? 'http://localhost:8080' : `${location.protocol}//${location.host}`);

/** Thin browser WebSocket wrapper that speaks our typed protocol. */
export class NetClient {
  private ws: WebSocket;

  constructor(
    url: string,
    private handlers: {
      onMessage: (msg: ServerMsg) => void;
      onOpen?: () => void;
      onClose?: () => void;
      onError?: () => void;
    },
  ) {
    this.ws = new WebSocket(url);
    this.ws.onopen = () => this.handlers.onOpen?.();
    this.ws.onclose = () => this.handlers.onClose?.();
    this.ws.onerror = () => this.handlers.onError?.();
    this.ws.onmessage = (e) => {
      try {
        this.handlers.onMessage(JSON.parse(e.data as string));
      } catch {
        /* ignore malformed messages */
      }
    };
  }

  send(msg: ClientMsg): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close(): void {
    try {
      this.ws.close();
    } catch {
      /* already closing */
    }
  }
}
