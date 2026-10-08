import { request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { Collector, classify } from './collector.ts';
import { createCollectorServer } from './server.ts';

const CHROME_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

describe('classify', () => {
  it.each([
    ['Chrome on a Mac', CHROME_MAC, { browser: 'chrome', os: 'macos', device: 'desktop' }],
    ['Safari on an iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', { browser: 'safari', os: 'ios', device: 'mobile' }],
    ['Chrome on an iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1', { browser: 'chrome', os: 'ios', device: 'mobile' }],
    ['Chrome on an Android phone', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36', { browser: 'chrome', os: 'android', device: 'mobile' }],
    ['Firefox on an Android tablet', 'Mozilla/5.0 (Android 14; Tablet; rv:127.0) Gecko/127.0 Firefox/127.0', { browser: 'firefox', os: 'android', device: 'tablet' }],
    ['Edge on Windows', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0', { browser: 'edge', os: 'windows', device: 'desktop' }],
    ['Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', { browser: 'other', os: 'other', device: 'bot' }],
    ['no User-Agent at all', '', { browser: 'other', os: 'other', device: 'bot' }],
  ])('%s', (_name, userAgent, expected) => {
    expect(classify(userAgent)).toEqual(expected);
  });
});

describe('Collector', () => {
  it('counts a listed event under its labels', () => {
    const collector = new Collector();
    expect(collector.accept({ e: 'sync', l: { side: 'mine', leagues: 'one' } })).toBe(true);
    expect(collector.accept({ e: 'sync', l: { leagues: 'one', side: 'mine' } })).toBe(true);
    expect(collector.accept({ e: 'sync', l: { side: 'both', leagues: 'many' } })).toBe(true);
    const text = collector.render();
    expect(text).toContain('# TYPE statwatch_sync_total counter');
    expect(text).toContain('statwatch_sync_total{leagues="one",side="mine"} 2\n');
    expect(text).toContain('statwatch_sync_total{leagues="many",side="both"} 1\n');
  });

  it('adds browser, system and device to a visit from the User-Agent, and never keeps the header', () => {
    const collector = new Collector();
    collector.accept({ e: 'visit' }, CHROME_MAC);
    const text = collector.render();
    expect(text).toContain('statwatch_visit_total{browser="chrome",device="desktop",os="macos"} 1\n');
    expect(text).not.toContain('Mozilla');
  });

  it('shows label-less events as 0 from the start', () => {
    const text = new Collector().render();
    expect(text).toContain('statwatch_js_error_total 0\n');
    expect(text).toContain('statwatch_active_sessions 0\n');
    expect(text).toContain('statwatch_web_vital_count{name="LCP"} 0\n');
  });

  it.each([
    ['not an object', 'sync'],
    ['an array', []],
    ['no event name', {}],
    ['an unknown event', { e: 'purchase' }],
    ['an event named like an object property', { e: 'constructor' }],
    ['a prototype key', { e: '__proto__' }],
    ['a missing label', { e: 'sync', l: { side: 'mine' } }],
    ['an extra label', { e: 'sync', l: { side: 'mine', leagues: 'one', league_id: '409479118' } }],
    ['a label value that is not on the list', { e: 'sync', l: { side: 'mine', leagues: 'seven' } }],
    ['a label that is not a string', { e: 'sync', l: { side: 1, leagues: 'one' } }],
    ['labels on an event that has none', { e: 'js_error', l: { message: 'boom' } }],
  ])('rejects %s without creating a series', (_name, body) => {
    const collector = new Collector();
    const before = collector.render();
    expect(collector.accept(body)).toBe(false);
    expect(collector.render().replace(/rejected_total \d+/, '')).toBe(before.replace(/rejected_total \d+/, ''));
    expect(collector.render()).toContain('statwatch_events_rejected_total 1\n');
  });

  it('puts web vitals in cumulative histogram buckets', () => {
    const collector = new Collector();
    for (const value of [900, 3000, 20_000]) expect(collector.accept({ e: 'vital', l: { name: 'LCP' }, v: value })).toBe(true);
    const text = collector.render();
    expect(text).toContain('statwatch_web_vital_bucket{name="LCP",le="1000"} 1\n');
    expect(text).toContain('statwatch_web_vital_bucket{name="LCP",le="2500"} 1\n');
    expect(text).toContain('statwatch_web_vital_bucket{name="LCP",le="4000"} 2\n');
    expect(text).toContain('statwatch_web_vital_bucket{name="LCP",le="8000"} 2\n');
    expect(text).toContain('statwatch_web_vital_bucket{name="LCP",le="+Inf"} 3\n');
    expect(text).toContain('statwatch_web_vital_sum{name="LCP"} 23900\n');
    expect(text).toContain('statwatch_web_vital_count{name="LCP"} 3\n');
  });

  it.each([
    ['a negative value', { e: 'vital', l: { name: 'LCP' }, v: -1 }],
    ['a value that is not a number', { e: 'vital', l: { name: 'LCP' }, v: '5' }],
    ['an absurd value', { e: 'vital', l: { name: 'LCP' }, v: 1e12 }],
    ['an unknown vital', { e: 'vital', l: { name: 'FID' }, v: 5 }],
    ['no vital name', { e: 'vital', v: 5 }],
  ])('rejects a web vital with %s', (_name, body) => {
    expect(new Collector().accept(body)).toBe(false);
  });

  it('counts a tab as active for 90 seconds after its last heartbeat, once however often it beats', () => {
    const collector = new Collector();
    collector.accept({ e: 'beat', id: 'aaaaaaaa-1111' }, '', 0);
    collector.accept({ e: 'beat', id: 'aaaaaaaa-1111' }, '', 30_000);
    collector.accept({ e: 'beat', id: 'bbbbbbbb-2222' }, '', 60_000);
    expect(collector.active(60_000)).toBe(2);
    expect(collector.active(119_000)).toBe(2);
    expect(collector.active(121_000)).toBe(1); // the first tab's last beat was at 30 s
    expect(collector.render(200_000)).toContain('statwatch_active_sessions 0\n');
  });

  it('exports how many tabs are active but never their ids', () => {
    const collector = new Collector();
    collector.accept({ e: 'beat', id: 'secretid-1234' });
    expect(collector.render()).not.toContain('secretid');
  });

  it.each(['', 'short', 'UPPERCASE-ID-123', 'has spaces in it', 'x'.repeat(41), 5])('rejects the heartbeat id %j', (id) => {
    const collector = new Collector();
    expect(collector.accept({ e: 'beat', id })).toBe(false);
    expect(collector.active()).toBe(0);
  });
});

describe('collector server', () => {
  let server: Server;
  afterEach(() => void server.close());

  const send = (target: Server, method: string, path: string, body?: string, headers: Record<string, string> = {}) =>
    new Promise<{ status: number; text: string }>((resolve, reject) => {
      const req = request({ host: '127.0.0.1', port: (target.address() as AddressInfo).port, method, path, headers }, (res) => {
        let text = '';
        res.on('data', (chunk: Buffer) => (text += chunk));
        res.on('end', () => resolve({ status: res.statusCode!, text }));
      });
      req.on('error', reject);
      req.end(body);
    });
  async function call(method: string, path: string, body?: string, headers: Record<string, string> = {}) {
    server = createCollectorServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    return send(server, method, path, body, headers);
  }

  it('takes an event on POST /e and serves it on GET /metrics', async () => {
    const posted = await call('POST', '/e', JSON.stringify({ e: 'visit' }), { 'User-Agent': CHROME_MAC });
    expect(posted.status).toBe(204);
    const scraped = await send(server, 'GET', '/metrics');
    expect(scraped.status).toBe(200);
    expect(scraped.text).toContain('statwatch_visit_total{browser="chrome",device="desktop",os="macos"} 1');
  });

  it('answers 400 to an event it does not accept and to a body that is not JSON', async () => {
    expect((await call('POST', '/e', JSON.stringify({ e: 'purchase' }))).status).toBe(400);
    expect((await send(server, 'POST', '/e', 'not json')).status).toBe(400);
  });

  it('refuses a body over 2 KB', async () => {
    const response = await call('POST', '/e', JSON.stringify({ e: 'visit', pad: 'x'.repeat(3000) })).catch(() => ({ status: 413 }));
    expect(response.status).toBe(413);
  });

  it('knows no other paths or methods', async () => {
    expect((await call('GET', '/e')).status).toBe(404);
    expect((await send(server, 'POST', '/metrics', '{}')).status).toBe(404);
    expect((await send(server, 'GET', '/')).status).toBe(404);
  });
});
