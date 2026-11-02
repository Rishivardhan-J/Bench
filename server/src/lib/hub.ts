import pg from 'pg';
import type { WebSocket } from 'ws';
import { config } from '../config.ts';

interface Socket {
  ws: WebSocket;
  userId: string;
}

/**
 * Fans database change events out to browsers. One dedicated connection LISTENs on
 * `bench_events`; each event names the users to tell and the scopes that changed.
 */
class Hub {
  private sockets = new Set<Socket>();
  private listener: pg.Client | null = null;
  private stopped = false;

  add(ws: WebSocket, userId: string) {
    const entry = { ws, userId };
    this.sockets.add(entry);
    ws.on('close', () => this.sockets.delete(entry));
  }

  private dispatch(payload: string) {
    let event: { users: string[] | '*'; scopes: string[] };
    try {
      event = JSON.parse(payload);
    } catch {
      return;
    }
    const message = JSON.stringify({ scopes: event.scopes });
    for (const s of this.sockets) {
      if ((event.users === '*' || event.users.includes(s.userId)) && s.ws.readyState === 1) s.ws.send(message);
    }
  }

  async start() {
    this.stopped = false;
    const connect = async () => {
      if (this.stopped) return;
      const client = new pg.Client({ connectionString: config.databaseUrl });
      client.on('notification', (n) => n.payload && this.dispatch(n.payload));
      client.on('error', () => undefined);
      client.on('end', () => {
        this.listener = null;
        if (!this.stopped) setTimeout(() => void connect().catch(() => undefined), 2000);
      });
      try {
        await client.connect();
        await client.query('LISTEN bench_events');
        this.listener = client;
      } catch {
        await client.end().catch(() => undefined);
      }
    };
    await connect();
  }

  async stop() {
    this.stopped = true;
    for (const s of this.sockets) s.ws.close();
    this.sockets.clear();
    await this.listener?.end().catch(() => undefined);
  }
}

export const hub = new Hub();
