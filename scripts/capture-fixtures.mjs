// Saves real ESPN responses used by the tests. Test expectations are pinned
// to the Steelers at Browns game of week 4, 2026 (event 401872964, final 24-27).
import { mkdir, writeFile } from 'node:fs/promises';

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const dir = 'src/test/fixtures';

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

await mkdir(dir, { recursive: true });
const { header, boxscore, drives } = await get(`${SITE}/summary?event=401872964`);
await writeFile(`${dir}/summary-pit-cle.json`, JSON.stringify({ header, boxscore, drives }));
await writeFile(`${dir}/teams.json`, JSON.stringify(await get(`${SITE}/teams`)));
console.log('Fixtures written to', dir);
