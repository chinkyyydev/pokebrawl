import type { ClientMsg, ServerMsg } from './protocol';

// Where the browser connects:
//  - explicit override via VITE_WS_URL (if you ever split client/server hosts)
//  - local dev: the separate `npm run server` process on :8080
//  - production: same origin as the page (our Render service serves both)
export const WS_URL =
  (import.meta.env.VITE_WS_URL as string) ||
  (import.meta.env.DEV
    ? 'ws://localhost:8080'
    : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);

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
