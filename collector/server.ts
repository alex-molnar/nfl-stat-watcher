import { createServer, type Server } from 'node:http';
import { Collector } from './collector.ts';

const MAX_BODY = 2048; // an event is a few dozen bytes

/** POST /e takes one event (nginx forwards /api/e here), GET /metrics is what Prometheus scrapes. */
export function createCollectorServer(collector = new Collector()): Server {
  return createServer((req, res) => {
    const path = req.url?.split('?')[0];
    if (req.method === 'GET' && path === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' }).end(collector.render());
      return;
    }
    if (req.method !== 'POST' || path !== '/e') {
      res.writeHead(404).end();
      return;
    }
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      body += chunk;
      if (body.length > MAX_BODY) {
        res.writeHead(413).end();
        req.destroy();
      }
    });
    req.on('end', () => {
      if (res.writableEnded) return;
      let event: unknown;
      try {
        event = JSON.parse(body);
      } catch {
        event = undefined;
      }
      res.writeHead(collector.accept(event, req.headers['user-agent']) ? 204 : 400).end();
    });
  });
}
