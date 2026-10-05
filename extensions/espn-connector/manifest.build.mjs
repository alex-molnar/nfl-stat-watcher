import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';

const origin = process.env.STAT_WATCH_APP_ORIGIN ?? 'http://localhost:5173';
const url = new URL(origin);
if (url.pathname !== '/' || url.search || url.hash || (url.protocol !== 'https:' && url.hostname !== 'localhost')) {
  throw new Error('STAT_WATCH_APP_ORIGIN must be an https origin, or http://localhost[:port]');
}
const manifest = JSON.parse(await readFile(new URL('./manifest.json', import.meta.url), 'utf8'));
manifest.name = 'Stat Watch ESPN Connector';
manifest.externally_connectable.matches = [`${url.origin}/*`];
const output = new URL('./dist/', import.meta.url);
await mkdir(output, { recursive: true });
await Promise.all(['background.js', 'sanitize.js'].map((file) => cp(new URL(`./${file}`, import.meta.url), new URL(file, output))));
await writeFile(new URL('manifest.json', output), `${JSON.stringify(manifest, null, 2)}\n`);
