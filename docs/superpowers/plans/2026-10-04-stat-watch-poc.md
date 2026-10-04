# Stat Watch PoC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static React app that follows NFL players and team defenses across fantasy leagues, showing live stats and fantasy points from ESPN, packaged as a Docker image with a Kubernetes manifest.

**Architecture:** Single-page app, no backend. The browser calls ESPN's public JSON API directly (CORS is open). Pure TypeScript layers (`espn` client, `stats` normalizer, `scoring`, `storage`) sit under thin React hooks (TanStack Query for polling) and UI components in the "Field" visual language. State lives in localStorage behind small validated stores.

**Tech Stack:** React, TypeScript, Vite, React Router, TanStack Query, Vitest, React Testing Library, jsdom, nginx (unprivileged image), Kubernetes.

**Spec:** `docs/superpowers/specs/2026-10-04-stat-watch-poc-design.md`
**Visual reference:** `prototypes/main-screen.html`, variant "Field" (press `3`). The prototype was removed after the design was chosen, history in git, commit 50261f3.

## Global Constraints

- Node 22 (`node:22-alpine` in Docker). Runtime dependencies are exactly: `react`, `react-dom`, `react-router`, `@tanstack/react-query`. No other runtime dependency.
- All ESPN URLs live in `src/espn/client.ts`. Nothing else calls `fetch`.
- localStorage keys, verbatim: `nflsw:v1:followed`, `nflsw:v1:profiles`, `nflsw:v1:theme`.
- Polling: scoreboard every 60s while any game is live, otherwise every 600s; live game summary every 10s; final summaries fetched once; scheduled games not fetched.
- Fonts: Anybody (display) and Hanken Grotesk (text), from Google Fonts. Colors come from the CSS tokens in Task 7; no hard-coded colors in components except team colors from ESPN.
- UI copy: sentence case, plain verbs, no em dash characters anywhere (organization rule, applies to code, copy and docs).
- Fantasy totals render with exactly two decimals (`toFixed(2)`).
- Accessibility floor: native controls, visible focus, WCAG 2.2 AA contrast in both themes, no horizontal scroll at 390px, `prefers-reduced-motion` respected.
- Tests never reach the network: `src/test/setup.ts` stubs `fetch` with a 404 for every test; tests that need data use `mockFetch`.
- When an API used in this plan differs from the installed library version, look up current docs with the `ctx7` CLI before changing the call.
- Work on branch `feat/stat-watch-poc`. Commit after every task. Push only after Task 12 passes, and only if a git remote exists.

## Review Focus

1. **The same play listed in both `drives.previous` and `drives.current` during a live game.** Expected: each play is counted once (no double field goals or 2-point conversions). Test: Task 3, "dedupes plays".
2. **Players whose last name has a suffix or several parts** ("Marvin Harrison Jr.", "Amon-Ra St. Brown"). Expected: their 2-point conversions and field goals in play text are still credited. Test: Task 3, `shortName` cases.
3. **A made field goal whose distance cannot be parsed from the play text.** Expected: it still scores, at the 0-39 value, labelled "Field goals, distance unknown". Test: Task 4, "scores unparsed field goals".
4. **Deleting a profile when the same player is followed in both that profile and the target.** Expected: one card remains, not two. Test: Task 5, "drops duplicates when reassigning".
5. **ESPN fails during or before a game.** Expected: the card keeps the last numbers and says "Updated hh:mm, retrying", or "Live data unavailable, retrying" when nothing was ever loaded. Tests: Task 6 `freshness`, Task 8 "shows a retry note".

---

## File structure

```
.
├── Dockerfile, .dockerignore, nginx.conf          Task 11
├── k8s/deployment.yaml                            Task 11
├── index.html                                     Task 1 (theme script added in Task 7)
├── package.json, tsconfig.json, vite.config.ts    Task 1
├── scripts/capture-fixtures.mjs                   Task 2
├── README.md, docs/components.md                  Task 12
└── src/
    ├── main.tsx, App.tsx                          Task 1, rewritten in Task 7
    ├── styles.css                                 Task 7
    ├── espn/types.ts, espn/client.ts              Task 2
    ├── stats/types.ts, stats/normalize.ts         Task 3
    ├── stats/scoreboard.ts                        Task 6
    ├── scoring/types.ts, presets.ts, score.ts     Task 4
    ├── scoring/fields.ts                          Task 10
    ├── storage/types.ts                           Task 4
    ├── storage/store.ts, followed.ts,
    │   profiles.ts, theme.ts, useStore.ts         Task 5
    ├── hooks/queries.ts                           Task 6
    ├── ui/Header.tsx, ThemeToggle.tsx             Task 7
    ├── ui/format.ts, Bump.tsx, MiniField.tsx,
    │   EntryCard.tsx, MainPage.tsx                Task 8 (MainPage minimal in Task 7)
    ├── ui/AddDialog.tsx                           Task 9
    ├── ui/SettingsPage.tsx                        Task 10 (minimal in Task 7)
    └── test/setup.ts, render.tsx, mockFetch.ts,
        data.ts, fixtures/*.json                   Tasks 1, 2, 7, 8
```

Tests sit next to the code they test (`*.test.ts` / `*.test.tsx`).

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/test/setup.ts`, `src/App.test.tsx`

**Interfaces:**
- Produces: `npm test` (Vitest, jsdom, globals), `npm run build` (type check plus Vite build), `src/test/setup.ts` loaded before every test (cleans up, clears localStorage, stubs `fetch` with a 404, polyfills `<dialog>`).

- [ ] **Step 1: Create the branch**

```bash
git switch -c feat/stat-watch-poc
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "stat-watch",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "capture-fixtures": "node scripts/capture-fixtures.mjs"
  }
}
```

- [ ] **Step 3: Install dependencies**

```bash
npm install react react-dom react-router @tanstack/react-query
npm install -D vite @vitejs/plugin-react typescript vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom @types/react @types/react-dom @types/node
```

- [ ] **Step 4: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["vitest/globals", "node"]
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 5: Write `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

- [ ] **Step 6: Write `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Tests never reach the network. Tests that need data call mockFetch().
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('not mocked', { status: 404 })));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// jsdom does not implement <dialog>.
HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
  this.removeAttribute('open');
  this.dispatchEvent(new Event('close'));
};
```

- [ ] **Step 7: Write the failing test `src/App.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { App } from './App';

it('renders the app name', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Stat Watch' })).toBeInTheDocument();
});
```

- [ ] **Step 8: Run it and see it fail**

Run: `npm test`
Expected: FAIL, cannot resolve `./App`.

- [ ] **Step 9: Write `src/App.tsx`, `src/main.tsx`, `index.html`**

`src/App.tsx`:

```tsx
export function App() {
  return <h1>Stat Watch</h1>;
}
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Stat Watch</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 10: Run tests and build**

Run: `npm test && npm run build`
Expected: 1 test passes; build writes `dist/`.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src
git commit -m "chore: scaffold Vite React TypeScript app with Vitest"
```

---

### Task 2: ESPN client, response types and fixtures

**Files:**
- Create: `src/espn/types.ts`, `src/espn/client.ts`, `src/espn/client.test.ts`, `scripts/capture-fixtures.mjs`, `src/test/fixtures/summary-pit-cle.json`, `src/test/fixtures/teams.json`

**Interfaces:**
- Produces (`src/espn/client.ts`):
  - `class EspnError extends Error { status: number }`
  - `searchPlayers(query: string): Promise<EspnSearchItem[]>` (NFL items only)
  - `getAthlete(id: string): Promise<EspnAthleteResponse>`
  - `getTeams(): Promise<EspnTeamsResponse>`
  - `getScoreboard(): Promise<EspnScoreboard>`
  - `getSummary(eventId: string): Promise<EspnSummary>`
- Produces (`src/espn/types.ts`): the types below, used by Tasks 3, 6, 8, 9.

- [ ] **Step 1: Write `src/espn/types.ts`**

```ts
// The subset of ESPN's public API responses that the app reads.

export interface EspnTeamRef {
  id: string;
  abbreviation: string;
  displayName: string;
  location?: string;
  name?: string;
  color?: string; // hex without '#'
}

export interface EspnCompetitor {
  homeAway: 'home' | 'away';
  score?: string;
  team: EspnTeamRef;
}

export interface EspnStatus {
  period: number;
  displayClock: string;
  type: { state: 'pre' | 'in' | 'post'; completed: boolean; shortDetail: string };
}

export interface EspnEvent {
  id: string;
  date: string;
  status: EspnStatus;
  competitions: { competitors: EspnCompetitor[] }[];
}

export interface EspnScoreboard {
  events: EspnEvent[];
}

export interface EspnAthleteRef {
  id: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  jersey?: string;
}

export interface EspnStatCategory {
  name: string;
  keys: string[];
  totals?: string[];
  athletes: { athlete: EspnAthleteRef; stats: string[] }[];
}

export interface EspnPlaySpot {
  team?: { id: string };
  yardsToEndzone?: number;
  downDistanceText?: string;
  possessionText?: string;
}

export interface EspnPlay {
  id: string;
  text: string;
  scoringPlay?: boolean;
  start: EspnPlaySpot;
  end?: EspnPlaySpot;
}

export interface EspnSummary {
  header: { id: string; competitions: { competitors: EspnCompetitor[] }[] };
  boxscore: { players?: { team: { id: string; abbreviation?: string }; statistics: EspnStatCategory[] }[] };
  drives?: { previous?: { plays: EspnPlay[] }[]; current?: { plays: EspnPlay[] } };
}

export interface EspnSearchItem {
  id: string;
  displayName: string;
  league?: string;
}

export interface EspnAthleteResponse {
  athlete: {
    id: string;
    displayName: string;
    jersey?: string;
    position?: { abbreviation: string };
    team?: { id: string; abbreviation: string };
  };
}

export interface EspnTeamsResponse {
  sports: { leagues: { teams: { team: EspnTeamRef }[] }[] }[];
}
```

- [ ] **Step 2: Write the failing test `src/espn/client.test.ts`**

```ts
import { vi } from 'vitest';
import { EspnError, getScoreboard, getSummary, searchPlayers } from './client';

const okFetch = (body: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));

describe('espn client', () => {
  it('requests the summary for an event', async () => {
    const f = okFetch({ header: { id: '1', competitions: [] }, boxscore: {} });
    vi.stubGlobal('fetch', f);
    await getSummary('401872964');
    expect(f).toHaveBeenCalledWith(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=401872964',
    );
  });

  it('encodes the search query and keeps only NFL players', async () => {
    const f = okFetch({
      items: [
        { id: '3918298', displayName: 'Josh Allen', league: 'nfl' },
        { id: '4892153', displayName: 'Josh Allen', league: 'college-football' },
      ],
    });
    vi.stubGlobal('fetch', f);
    const items = await searchPlayers('josh allen');
    expect(f).toHaveBeenCalledWith(
      'https://site.web.api.espn.com/apis/common/v3/search?query=josh%20allen&limit=10&type=player',
    );
    expect(items).toEqual([{ id: '3918298', displayName: 'Josh Allen', league: 'nfl' }]);
  });

  it('returns an empty list when search has no items field', async () => {
    vi.stubGlobal('fetch', okFetch({}));
    expect(await searchPlayers('zz')).toEqual([]);
  });

  it('throws EspnError with the status on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })));
    await expect(getScoreboard()).rejects.toMatchObject({ name: 'EspnError', status: 503 });
    await expect(getScoreboard()).rejects.toBeInstanceOf(EspnError);
  });
});
```

- [ ] **Step 3: Run it and see it fail**

Run: `npx vitest run src/espn`
Expected: FAIL, cannot resolve `./client`.

- [ ] **Step 4: Write `src/espn/client.ts`**

```ts
import type {
  EspnAthleteResponse,
  EspnScoreboard,
  EspnSearchItem,
  EspnSummary,
  EspnTeamsResponse,
} from './types';

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const WEB = 'https://site.web.api.espn.com/apis/common/v3';

export class EspnError extends Error {
  readonly status: number;
  constructor(status: number, url: string) {
    super(`ESPN request failed with ${status}: ${url}`);
    this.name = 'EspnError';
    this.status = status;
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new EspnError(res.status, url);
  return (await res.json()) as T;
}

export async function searchPlayers(query: string): Promise<EspnSearchItem[]> {
  const res = await getJson<{ items?: EspnSearchItem[] }>(
    `${WEB}/search?query=${encodeURIComponent(query)}&limit=10&type=player`,
  );
  return (res.items ?? []).filter((item) => item.league === 'nfl');
}

export const getAthlete = (id: string) =>
  getJson<EspnAthleteResponse>(`${WEB}/sports/football/nfl/athletes/${id}`);

export const getTeams = () => getJson<EspnTeamsResponse>(`${SITE}/teams`);

export const getScoreboard = () => getJson<EspnScoreboard>(`${SITE}/scoreboard`);

export const getSummary = (eventId: string) =>
  getJson<EspnSummary>(`${SITE}/summary?event=${eventId}`);
```

- [ ] **Step 5: Run the test and see it pass**

Run: `npx vitest run src/espn`
Expected: 4 tests pass.

- [ ] **Step 6: Write `scripts/capture-fixtures.mjs`**

```js
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
```

- [ ] **Step 7: Capture the fixtures and check them**

Run: `npm run capture-fixtures && ls -la src/test/fixtures`
Expected: `summary-pit-cle.json` and `teams.json` exist. Sanity check:
`node -e "const s=require('./src/test/fixtures/summary-pit-cle.json');console.log(s.header.competitions[0].competitors.map(c=>c.team.abbreviation+' '+c.score))"` prints `[ 'CLE 27', 'PIT 24' ]`.

- [ ] **Step 8: Commit**

```bash
git add src/espn scripts src/test/fixtures
git commit -m "feat: add ESPN client, response types and test fixtures"
```

---

### Task 3: Stats normalizer

**Files:**
- Create: `src/stats/types.ts`, `src/stats/normalize.ts`, `src/stats/normalize.test.ts`

**Interfaces:**
- Consumes: `EspnSummary`, `EspnPlay`, `EspnStatCategory`, `EspnAthleteRef` from `src/espn/types.ts`.
- Produces (`src/stats/types.ts`): `PlayerStats`, `DefenseStats`, `Situation`, `GameStats` as below.
- Produces (`src/stats/normalize.ts`):
  - `normalizeSummary(summary: EspnSummary): GameStats`
  - `shortName(a: { firstName?: string; lastName?: string; displayName: string }): string`
  - `allPlays(summary: EspnSummary): EspnPlay[]` (deduped by play id)
  - `situationFrom(plays: EspnPlay[]): Situation | null`

- [ ] **Step 1: Write `src/stats/types.ts`**

```ts
export interface PlayerStats {
  passing?: { completions: number; attempts: number; yards: number; touchdowns: number; interceptions: number };
  rushing?: { attempts: number; yards: number; touchdowns: number };
  receiving?: { receptions: number; targets: number; yards: number; touchdowns: number };
  fumbles?: { fumbles: number; lost: number; recovered: number };
  defense?: {
    totalTackles: number;
    soloTackles: number;
    sacks: number;
    tacklesForLoss: number;
    passesDefended: number;
    qbHits: number;
    touchdowns: number;
  };
  interceptions?: { interceptions: number; touchdowns: number };
  returns?: { touchdowns: number }; // kick and punt return TDs
  kicking?: {
    fgMade: number;
    fgAttempts: number;
    longest: number;
    xpMade: number;
    xpAttempts: number;
    madeDistances: number[]; // parsed from play text
  };
  twoPointConversions: number;
  safeties: number;
}

export interface DefenseStats {
  sacks: number;
  interceptions: number;
  fumbleRecoveries: number;
  touchdowns: number; // defensive plus kick and punt return TDs
  safeties: number;
  pointsAllowed: number; // the opponent's score
}

export interface Situation {
  possessionTeamId: string;
  yardsToEndzone: number;
  downDistanceText: string; // for example "2nd & 6 at DEN 12"
  lastPlayText: string;
}

export interface GameStats {
  players: Record<string, PlayerStats>; // keyed by ESPN athlete id
  defenses: Record<string, DefenseStats>; // keyed by ESPN team id
  situation: Situation | null;
}
```

- [ ] **Step 2: Write the failing test `src/stats/normalize.test.ts`**

```ts
import summaryJson from '../test/fixtures/summary-pit-cle.json';
import type { EspnPlay, EspnSummary } from '../espn/types';
import { allPlays, normalizeSummary, shortName, situationFrom } from './normalize';

const summary = summaryJson as unknown as EspnSummary;
const game = normalizeSummary(summary);

describe('normalizeSummary on PIT 24 at CLE 27', () => {
  it('reads passing and credits a successful 2-point run', () => {
    expect(game.players['8439']?.passing).toEqual({ completions: 22, attempts: 40, yards: 299, touchdowns: 3, interceptions: 2 });
    expect(game.players['8439']?.twoPointConversions).toBe(1);
  });

  it('reads rushing and receiving, and does not credit a failed 2-point attempt', () => {
    const warren = game.players['4569987'];
    expect(warren?.rushing).toEqual({ attempts: 17, yards: 93, touchdowns: 0 });
    expect(warren?.receiving).toEqual({ receptions: 3, targets: 6, yards: 33, touchdowns: 0 });
    expect(warren?.twoPointConversions).toBe(0);
  });

  it('reads a tight end touchdown', () => {
    expect(game.players['4430802']?.receiving).toEqual({ receptions: 3, targets: 5, yards: 27, touchdowns: 1 });
  });

  it('reads kicking and parses made field goal distances', () => {
    expect(game.players['17372']?.kicking).toEqual({ fgMade: 1, fgAttempts: 2, longest: 31, xpMade: 1, xpAttempts: 1, madeDistances: [31] });
    expect(game.players['4258620']?.kicking?.madeDistances).toEqual([44, 56]);
  });

  it('reads individual defense, interceptions and fumbles', () => {
    expect(game.players['4361652']?.defense).toEqual({ totalTackles: 9, soloTackles: 7, sacks: 1, tacklesForLoss: 1, passesDefended: 0, qbHits: 1, touchdowns: 0 });
    expect(game.players['3045282']?.fumbles?.recovered).toBe(1);
    expect(game.players['4820584']?.interceptions).toEqual({ interceptions: 1, touchdowns: 0 });
    expect(game.players['3122840']?.fumbles?.lost).toBe(1);
  });

  it('builds team defense stats for both teams', () => {
    expect(game.defenses['23']).toEqual({ sacks: 2, interceptions: 1, fumbleRecoveries: 1, touchdowns: 0, safeties: 0, pointsAllowed: 27 });
    expect(game.defenses['5']).toEqual({ sacks: 5, interceptions: 2, fumbleRecoveries: 0, touchdowns: 0, safeties: 0, pointsAllowed: 24 });
  });
});

describe('shortName', () => {
  it('matches the play text style', () => {
    expect(shortName({ firstName: 'Aaron', lastName: 'Rodgers', displayName: 'Aaron Rodgers' })).toBe('A.Rodgers');
    expect(shortName({ firstName: 'T.J.', lastName: 'Watt', displayName: 'T.J. Watt' })).toBe('T.Watt');
  });
  it('drops name suffixes', () => {
    expect(shortName({ firstName: 'Marvin', lastName: 'Harrison Jr.', displayName: 'Marvin Harrison Jr.' })).toBe('M.Harrison');
  });
  it('keeps the first part of a multi-part last name', () => {
    expect(shortName({ firstName: 'Amon-Ra', lastName: 'St. Brown', displayName: 'Amon-Ra St. Brown' })).toBe('A.St.');
  });
  it('falls back to the display name', () => {
    expect(shortName({ displayName: 'Brock Purdy' })).toBe('B.Purdy');
  });
});

const play = (id: string, text: string, team: string, end?: EspnPlay['end']): EspnPlay => ({
  id, text, start: { team: { id: team }, yardsToEndzone: 40, downDistanceText: '1st & 10 at X 40' }, end,
});

describe('plays', () => {
  it('dedupes plays that appear in both previous and current drives', () => {
    const fg = play('1', 'C.Boswell 31 yard field goal is GOOD, Center-C.Kuntz.', '23');
    const s: EspnSummary = { ...summary, drives: { previous: [{ plays: [fg] }], current: { plays: [fg] } } };
    expect(allPlays(s)).toHaveLength(1);
    expect(normalizeSummary(s).players['17372']?.kicking?.madeDistances).toEqual([31]);
  });

  it('credits a safety to the defending team and the named defender', () => {
    const safety = play('9', 'D.Watson sacked in End Zone by T.Watt, SAFETY.', '5');
    const s: EspnSummary = { ...summary, drives: { previous: [{ plays: [safety] }] } };
    const g = normalizeSummary(s);
    expect(g.defenses['23']?.safeties).toBe(1);
    expect(g.defenses['5']?.safeties).toBe(0);
    expect(g.players['3045282']?.safeties).toBe(1);
  });

  it('derives the situation from the end of the last play', () => {
    const last = play('3', 'B.Purdy pass short right to G.Kittle for 18 yards', '25', {
      team: { id: '25' }, yardsToEndzone: 12, downDistanceText: '2nd & 6 at DEN 12',
    });
    expect(situationFrom([last])).toEqual({ possessionTeamId: '25', yardsToEndzone: 12, downDistanceText: '2nd & 6 at DEN 12', lastPlayText: last.text });
  });

  it('falls back to the start spot and returns null without plays', () => {
    expect(situationFrom([play('4', 'Kickoff', '7')])?.yardsToEndzone).toBe(40);
    expect(situationFrom([])).toBeNull();
  });
});
```

- [ ] **Step 3: Run it and see it fail**

Run: `npx vitest run src/stats`
Expected: FAIL, cannot resolve `./normalize`.

- [ ] **Step 4: Write `src/stats/normalize.ts`**

```ts
import type { EspnAthleteRef, EspnPlay, EspnStatCategory, EspnSummary } from '../espn/types';
import type { DefenseStats, GameStats, PlayerStats, Situation } from './types';

const num = (s: string | undefined) => {
  const n = Number.parseFloat(s ?? '');
  return Number.isFinite(n) ? n : 0;
};

function pick(cat: EspnStatCategory, values: string[] | undefined, key: string): number {
  const i = cat.keys.indexOf(key);
  return i === -1 || !values ? 0 : num(values[i]);
}

function pair(cat: EspnStatCategory, values: string[], key: string): [number, number] {
  const i = cat.keys.indexOf(key);
  const [a, b] = (i === -1 ? '' : values[i] ?? '').split('/');
  return [num(a), num(b)];
}

/** "Aaron Rodgers" -> "A.Rodgers", the way ESPN play text names players. */
export function shortName(a: Pick<EspnAthleteRef, 'firstName' | 'lastName' | 'displayName'>): string {
  const parts = a.displayName.split(' ');
  const first = a.firstName ?? parts[0] ?? '';
  const last = (a.lastName ?? parts.slice(1).join(' ')).split(' ')[0] ?? '';
  return `${first.charAt(0)}.${last}`;
}

export function allPlays(s: EspnSummary): EspnPlay[] {
  const plays = [...(s.drives?.previous ?? []).flatMap((d) => d.plays), ...(s.drives?.current?.plays ?? [])];
  const seen = new Set<string>();
  return plays.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

export function situationFrom(plays: EspnPlay[]): Situation | null {
  const last = plays.at(-1);
  if (!last) return null;
  const spot = last.end?.team?.id && last.end.yardsToEndzone != null ? last.end : last.start;
  if (!spot.team?.id || spot.yardsToEndzone == null) return null;
  return {
    possessionTeamId: spot.team.id,
    yardsToEndzone: spot.yardsToEndzone,
    downDistanceText: spot.downDistanceText ?? '',
    lastPlayText: last.text,
  };
}

type Named = { id: string; teamId: string; short: string };

const FIELD_GOAL = /(\d+) yard field goal is GOOD/i;
const TWO_POINT = /TWO-POINT CONVERSION ATTEMPT\.(.*?)ATTEMPT SUCCEEDS/i;
const SAFETY = /\bSAFETY\b/;

function applyPlays(
  plays: EspnPlay[],
  players: Record<string, PlayerStats>,
  defenses: Record<string, DefenseStats>,
  names: Named[],
) {
  for (const play of plays) {
    const offense = play.start.team?.id;
    if (!offense) continue;

    const fg = FIELD_GOAL.exec(play.text);
    if (fg) {
      const kicker = names.find((n) => n.teamId === offense && players[n.id]?.kicking && play.text.includes(n.short));
      players[kicker?.id ?? '']?.kicking?.madeDistances.push(Number(fg[1]));
    }

    const two = TWO_POINT.exec(play.text);
    if (two) {
      for (const n of names) {
        if (n.teamId === offense && two[1]!.includes(n.short)) players[n.id]!.twoPointConversions += 1;
      }
    }

    if (SAFETY.test(play.text)) {
      const defense = Object.keys(defenses).find((id) => id !== offense);
      if (defense) {
        defenses[defense]!.safeties += 1;
        for (const n of names) {
          if (n.teamId === defense && play.text.includes(n.short)) players[n.id]!.safeties += 1;
        }
      }
    }
  }
}

export function normalizeSummary(s: EspnSummary): GameStats {
  const players: Record<string, PlayerStats> = {};
  const names: Named[] = [];
  const teams = s.boxscore.players ?? [];
  const player = (id: string) => (players[id] ??= { twoPointConversions: 0, safeties: 0 });

  for (const team of teams) {
    for (const cat of team.statistics) {
      for (const { athlete, stats } of cat.athletes) {
        if (!names.some((n) => n.id === athlete.id)) {
          names.push({ id: athlete.id, teamId: team.team.id, short: shortName(athlete) });
        }
        const p = player(athlete.id);
        const v = (key: string) => pick(cat, stats, key);
        switch (cat.name) {
          case 'passing': {
            const [completions, attempts] = pair(cat, stats, 'completions/passingAttempts');
            p.passing = { completions, attempts, yards: v('passingYards'), touchdowns: v('passingTouchdowns'), interceptions: v('interceptions') };
            break;
          }
          case 'rushing':
            p.rushing = { attempts: v('rushingAttempts'), yards: v('rushingYards'), touchdowns: v('rushingTouchdowns') };
            break;
          case 'receiving':
            p.receiving = { receptions: v('receptions'), targets: v('receivingTargets'), yards: v('receivingYards'), touchdowns: v('receivingTouchdowns') };
            break;
          case 'fumbles':
            p.fumbles = { fumbles: v('fumbles'), lost: v('fumblesLost'), recovered: v('fumblesRecovered') };
            break;
          case 'defensive':
            p.defense = {
              totalTackles: v('totalTackles'), soloTackles: v('soloTackles'), sacks: v('sacks'),
              tacklesForLoss: v('tacklesForLoss'), passesDefended: v('passesDefended'), qbHits: v('QBHits'),
              touchdowns: v('defensiveTouchdowns'),
            };
            break;
          case 'interceptions':
            p.interceptions = { interceptions: v('interceptions'), touchdowns: v('interceptionTouchdowns') };
            break;
          case 'kickReturns':
          case 'puntReturns':
            p.returns = {
              touchdowns: (p.returns?.touchdowns ?? 0) + v(cat.name === 'kickReturns' ? 'kickReturnTouchdowns' : 'puntReturnTouchdowns'),
            };
            break;
          case 'kicking': {
            const [fgMade, fgAttempts] = pair(cat, stats, 'fieldGoalsMade/fieldGoalAttempts');
            const [xpMade, xpAttempts] = pair(cat, stats, 'extraPointsMade/extraPointAttempts');
            p.kicking = { fgMade, fgAttempts, longest: v('longFieldGoalMade'), xpMade, xpAttempts, madeDistances: [] };
            break;
          }
        }
      }
    }
  }

  const scores: Record<string, number> = {};
  for (const c of s.header.competitions[0]?.competitors ?? []) scores[c.team.id] = num(c.score);

  const total = (team: (typeof teams)[number] | undefined, name: string, key: string) => {
    const cat = team?.statistics.find((c) => c.name === name);
    return cat ? pick(cat, cat.totals, key) : 0;
  };

  const defenses: Record<string, DefenseStats> = {};
  for (const team of teams) {
    const opp = teams.find((t) => t.team.id !== team.team.id);
    defenses[team.team.id] = {
      sacks: total(team, 'defensive', 'sacks'),
      interceptions: total(team, 'interceptions', 'interceptions'),
      fumbleRecoveries: total(opp, 'fumbles', 'fumblesLost'),
      touchdowns:
        total(team, 'defensive', 'defensiveTouchdowns') +
        total(team, 'kickReturns', 'kickReturnTouchdowns') +
        total(team, 'puntReturns', 'puntReturnTouchdowns'),
      safeties: 0,
      pointsAllowed: opp ? scores[opp.team.id] ?? 0 : 0,
    };
  }

  const plays = allPlays(s);
  applyPlays(plays, players, defenses, names);
  return { players, defenses, situation: situationFrom(plays) };
}
```

- [ ] **Step 5: Run the tests and see them pass**

Run: `npx vitest run src/stats`
Expected: all tests pass. If an expectation on a real fixture number fails, print the value from the fixture and compare it with the box score before touching code. ESPN occasionally applies stat corrections to finished games; in that case update the expectation here and the matching numbers in Tasks 4 and 8.

- [ ] **Step 6: Commit**

```bash
git add src/stats
git commit -m "feat: normalize ESPN game summaries into player and defense stats"
```

---

### Task 4: Scoring

**Files:**
- Create: `src/storage/types.ts`, `src/scoring/types.ts`, `src/scoring/presets.ts`, `src/scoring/score.ts`, `src/scoring/score.test.ts`

**Interfaces:**
- Consumes: `PlayerStats`, `DefenseStats`, `GameStats` (Task 3).
- Produces:
  - `FollowedEntry` (`src/storage/types.ts`, used by Tasks 5, 8, 9, 10)
  - `ScoringValues`, `PresetId`, `Profile`, `ScoreLine`, `ScoreResult`, `POINTS_ALLOWED_TIERS` (`src/scoring/types.ts`)
  - `PRESETS: Record<PresetId, ScoringValues>`, `PRESET_LABELS: Record<PresetId, string>`, `copyValues(v: ScoringValues): ScoringValues` (`src/scoring/presets.ts`)
  - `scorePlayer(s: PlayerStats, v: ScoringValues): ScoreResult`, `scoreDefense(d: DefenseStats, v: ScoringValues): ScoreResult`, `scoreEntry(entry: FollowedEntry, game: GameStats | undefined, v: ScoringValues): ScoreResult`, `tierIndex(pointsAllowed: number): number` (`src/scoring/score.ts`)

- [ ] **Step 1: Write `src/storage/types.ts`**

```ts
export interface FollowedEntry {
  kind: 'player' | 'defense';
  espnId: string; // athlete id for players, team id for defenses
  name: string;
  teamId: string;
  teamAbbr: string;
  position: string; // 'QB', 'LB', 'K', ... or 'D/ST'
  jersey?: string;
  profileId: string;
}
```

- [ ] **Step 2: Write `src/scoring/types.ts`**

```ts
export interface ScoringValues {
  passYards: number; passTd: number; interception: number;
  rushYards: number; rushTd: number;
  reception: number; recYards: number; recTd: number;
  twoPoint: number; fumbleLost: number; returnTd: number;
  fg0to39: number; fg40to49: number; fg50plus: number; fgMissed: number; xpMade: number; xpMissed: number;
  soloTackle: number; assistedTackle: number; sack: number; tackleForLoss: number; qbHit: number;
  passDefended: number; idpInterception: number; fumbleRecovery: number; defensiveTd: number; safety: number;
  dstSack: number; dstInterception: number; dstFumbleRecovery: number; dstSafety: number; dstTd: number;
  pointsAllowed: number[]; // 7 tiers, see POINTS_ALLOWED_TIERS
}

export type PresetId = 'standard' | 'half' | 'ppr';

export interface Profile {
  id: string;
  name: string;
  preset: PresetId | 'custom';
  values: ScoringValues;
}

export interface ScoreLine { label: string; points: number }
export interface ScoreResult { total: number; breakdown: ScoreLine[] }

export const POINTS_ALLOWED_TIERS = ['0', '1-6', '7-13', '14-20', '21-27', '28-34', '35+'] as const;
```

- [ ] **Step 3: Write `src/scoring/presets.ts`**

```ts
import type { PresetId, ScoringValues } from './types';

const BASE: ScoringValues = {
  passYards: 0.04, passTd: 4, interception: -2,
  rushYards: 0.1, rushTd: 6,
  reception: 1, recYards: 0.1, recTd: 6,
  twoPoint: 2, fumbleLost: -2, returnTd: 6,
  fg0to39: 3, fg40to49: 4, fg50plus: 5, fgMissed: -1, xpMade: 1, xpMissed: -1,
  soloTackle: 1, assistedTackle: 0.5, sack: 2, tackleForLoss: 1, qbHit: 0.5,
  passDefended: 1, idpInterception: 3, fumbleRecovery: 2, defensiveTd: 6, safety: 2,
  dstSack: 1, dstInterception: 2, dstFumbleRecovery: 2, dstSafety: 2, dstTd: 6,
  pointsAllowed: [10, 7, 4, 1, 0, -1, -4],
};

export const copyValues = (v: ScoringValues): ScoringValues => ({ ...v, pointsAllowed: [...v.pointsAllowed] });

export const PRESETS: Record<PresetId, ScoringValues> = {
  standard: { ...copyValues(BASE), reception: 0 },
  half: { ...copyValues(BASE), reception: 0.5 },
  ppr: copyValues(BASE),
};

export const PRESET_LABELS: Record<PresetId, string> = { standard: 'Standard', half: 'Half PPR', ppr: 'PPR' };
```

- [ ] **Step 4: Write the failing test `src/scoring/score.test.ts`**

```ts
import summaryJson from '../test/fixtures/summary-pit-cle.json';
import type { EspnSummary } from '../espn/types';
import { normalizeSummary } from '../stats/normalize';
import type { FollowedEntry } from '../storage/types';
import { PRESETS } from './presets';
import { scoreDefense, scoreEntry, scorePlayer, tierIndex } from './score';

const game = normalizeSummary(summaryJson as unknown as EspnSummary);
const ppr = PRESETS.ppr;
const total = (id: string, v = ppr) => scorePlayer(game.players[id]!, v).total;

describe('scorePlayer on PIT at CLE', () => {
  it('scores a QB with a 2-point conversion', () => expect(total('8439')).toBeCloseTo(21.96));
  it('scores a QB with a lost fumble and no recovery points for his own fumble', () => expect(total('3122840')).toBeCloseTo(12.92));
  it('scores a RB in all three presets', () => {
    expect(total('4569987', PRESETS.ppr)).toBeCloseTo(15.6);
    expect(total('4569987', PRESETS.half)).toBeCloseTo(14.1);
    expect(total('4569987', PRESETS.standard)).toBeCloseTo(12.6);
  });
  it('scores a TE touchdown', () => expect(total('4430802')).toBeCloseTo(11.7));
  it('scores kickers by distance, with misses', () => {
    expect(total('17372')).toBeCloseTo(3); // 31 yd (3) + miss (-1) + XP (1)
    expect(total('4258620')).toBeCloseTo(12); // 44 (4) + 56 (5) + 3 XP
  });
  it('scores IDP players', () => {
    expect(total('4361652')).toBeCloseTo(11.5);
    expect(total('3045282')).toBeCloseTo(12);
  });
  it('lists each scoring category in the breakdown', () => {
    expect(scorePlayer(game.players['8439']!, ppr).breakdown).toEqual([
      { label: 'Passing yards', points: 11.96 },
      { label: 'Passing TDs', points: 12 },
      { label: 'Interceptions thrown', points: -4 },
      { label: '2-point conversions', points: 2 },
    ]);
  });
  it('scores unparsed field goals at the 0-39 value', () => {
    const k = { twoPointConversions: 0, safeties: 0, kicking: { fgMade: 2, fgAttempts: 2, longest: 50, xpMade: 0, xpAttempts: 0, madeDistances: [50] } };
    const r = scorePlayer(k, ppr);
    expect(r.total).toBeCloseTo(8);
    expect(r.breakdown).toContainEqual({ label: 'Field goals, distance unknown', points: 3 });
  });
});

describe('scoreDefense', () => {
  it('scores both team defenses', () => {
    expect(scoreDefense(game.defenses['23']!, ppr).total).toBeCloseTo(6);
    expect(scoreDefense(game.defenses['5']!, ppr).total).toBeCloseTo(9);
  });
  it('maps points allowed to tiers at every boundary', () => {
    const cases: [number, number][] = [[0, 0], [1, 1], [6, 1], [7, 2], [13, 2], [14, 3], [20, 3], [21, 4], [27, 4], [28, 5], [34, 5], [35, 6], [52, 6]];
    for (const [pa, tier] of cases) expect(tierIndex(pa)).toBe(tier);
  });
});

describe('scoreEntry', () => {
  const base: FollowedEntry = { kind: 'player', espnId: '4569987', name: 'Jaylen Warren', teamId: '23', teamAbbr: 'PIT', position: 'RB', profileId: 'p1' };
  it('scores a player entry', () => expect(scoreEntry(base, game, ppr).total).toBeCloseTo(15.6));
  it('scores a defense entry by team id', () => {
    expect(scoreEntry({ ...base, kind: 'defense', espnId: '23', position: 'D/ST' }, game, ppr).total).toBeCloseTo(6);
  });
  it('returns zero without game stats or without a box score line', () => {
    expect(scoreEntry(base, undefined, ppr)).toEqual({ total: 0, breakdown: [] });
    expect(scoreEntry({ ...base, espnId: '1' }, game, ppr)).toEqual({ total: 0, breakdown: [] });
  });
});
```

- [ ] **Step 5: Run it and see it fail**

Run: `npx vitest run src/scoring`
Expected: FAIL, cannot resolve `./score`.

- [ ] **Step 6: Write `src/scoring/score.ts`**

```ts
import type { DefenseStats, GameStats, PlayerStats } from '../stats/types';
import type { FollowedEntry } from '../storage/types';
import type { ScoreLine, ScoreResult, ScoringValues } from './types';

const round2 = (n: number) => Math.round(n * 100) / 100;

function collect(fill: (add: (label: string, points: number) => void) => void): ScoreResult {
  const breakdown: ScoreLine[] = [];
  fill((label, points) => {
    if (points !== 0) breakdown.push({ label, points: round2(points) });
  });
  return { total: round2(breakdown.reduce((sum, l) => sum + l.points, 0)), breakdown };
}

export function tierIndex(pointsAllowed: number): number {
  const upper = [0, 6, 13, 20, 27, 34];
  const i = upper.findIndex((max) => pointsAllowed <= max);
  return i === -1 ? 6 : i;
}

export function scorePlayer(s: PlayerStats, v: ScoringValues): ScoreResult {
  return collect((add) => {
    if (s.passing) {
      add('Passing yards', s.passing.yards * v.passYards);
      add('Passing TDs', s.passing.touchdowns * v.passTd);
      add('Interceptions thrown', s.passing.interceptions * v.interception);
    }
    if (s.rushing) {
      add('Rushing yards', s.rushing.yards * v.rushYards);
      add('Rushing TDs', s.rushing.touchdowns * v.rushTd);
    }
    if (s.receiving) {
      add('Receptions', s.receiving.receptions * v.reception);
      add('Receiving yards', s.receiving.yards * v.recYards);
      add('Receiving TDs', s.receiving.touchdowns * v.recTd);
    }
    add('2-point conversions', s.twoPointConversions * v.twoPoint);
    if (s.fumbles) add('Fumbles lost', s.fumbles.lost * v.fumbleLost);
    if (s.returns) add('Return TDs', s.returns.touchdowns * v.returnTd);
    if (s.kicking) {
      const k = s.kicking;
      for (const d of k.madeDistances) add(`${d}-yard field goal`, d >= 50 ? v.fg50plus : d >= 40 ? v.fg40to49 : v.fg0to39);
      add('Field goals, distance unknown', Math.max(0, k.fgMade - k.madeDistances.length) * v.fg0to39);
      add('Missed field goals', (k.fgAttempts - k.fgMade) * v.fgMissed);
      add('Extra points', k.xpMade * v.xpMade);
      add('Missed extra points', (k.xpAttempts - k.xpMade) * v.xpMissed);
    }
    if (s.defense) {
      const d = s.defense;
      add('Solo tackles', d.soloTackles * v.soloTackle);
      add('Assisted tackles', (d.totalTackles - d.soloTackles) * v.assistedTackle);
      add('Sacks', d.sacks * v.sack);
      add('Tackles for loss', d.tacklesForLoss * v.tackleForLoss);
      add('QB hits', d.qbHits * v.qbHit);
      add('Passes defended', d.passesDefended * v.passDefended);
      add('Defensive TDs', d.touchdowns * v.defensiveTd);
      // Only defenders score recoveries; an offensive player recovering his own fumble does not.
      if (s.fumbles) add('Fumble recoveries', s.fumbles.recovered * v.fumbleRecovery);
    }
    if (s.interceptions) add('Interceptions', s.interceptions.interceptions * v.idpInterception);
    add('Safeties', s.safeties * v.safety);
  });
}

export function scoreDefense(d: DefenseStats, v: ScoringValues): ScoreResult {
  return collect((add) => {
    add('Sacks', d.sacks * v.dstSack);
    add('Interceptions', d.interceptions * v.dstInterception);
    add('Fumble recoveries', d.fumbleRecoveries * v.dstFumbleRecovery);
    add('Safeties', d.safeties * v.dstSafety);
    add('Touchdowns', d.touchdowns * v.dstTd);
    add(`${d.pointsAllowed} points allowed`, v.pointsAllowed[tierIndex(d.pointsAllowed)] ?? 0);
  });
}

const EMPTY: ScoreResult = { total: 0, breakdown: [] };

export function scoreEntry(entry: FollowedEntry, game: GameStats | undefined, v: ScoringValues): ScoreResult {
  if (!game) return EMPTY;
  if (entry.kind === 'defense') {
    const d = game.defenses[entry.teamId];
    return d ? scoreDefense(d, v) : EMPTY;
  }
  const s = game.players[entry.espnId];
  return s ? scorePlayer(s, v) : EMPTY;
}
```

- [ ] **Step 7: Run the tests and see them pass**

Run: `npx vitest run src/scoring`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/scoring src/storage/types.ts
git commit -m "feat: add fantasy scoring with presets for players, IDP and team defenses"
```

---

### Task 5: localStorage stores

**Files:**
- Create: `src/storage/store.ts`, `src/storage/followed.ts`, `src/storage/profiles.ts`, `src/storage/theme.ts`, `src/storage/useStore.ts`, `src/storage/storage.test.ts`
- Modify: `src/test/setup.ts` (reload stores after each test)

**Interfaces:**
- Consumes: `FollowedEntry`, `Profile`, `PresetId`, `ScoringValues`, `PRESETS`, `copyValues` (Task 4).
- Produces:
  - `store.ts`: `interface Store<T> { get(): T; set(next: T): void; subscribe(listener: () => void): () => void; reload(): void }`, `createStore<T>(opts)`, `reloadAllStores(): void`
  - `followed.ts`: `followedStore`, `sameEntry(a, b)`, `addEntry(e)`, `removeEntry(e)`, `moveEntry(e, toProfileId)`, `updateEntryTeam(espnId, patch)`, `reassignProfile(fromId, toId)`, `withValidProfiles(entries, profileIds)`
  - `profiles.ts`: `profilesStore`, `addProfile(name): string`, `renameProfile(id, name)`, `deleteProfile(id, moveTo): boolean`, `setValue(id, key, value)`, `setTier(id, index, value)`, `applyPreset(id, preset)`
  - `theme.ts`: `type Theme = 'light' | 'dark'`, `themeStore` (`Theme | null`), `setTheme(t: Theme)`
  - `useStore.ts`: `useStore<T>(store: Store<T>): T`

- [ ] **Step 1: Write the failing test `src/storage/storage.test.ts`**

```ts
import { vi } from 'vitest';
import { PRESETS, copyValues } from '../scoring/presets';
import type { Profile } from '../scoring/types';
import type { FollowedEntry } from './types';
import { addEntry, followedStore, moveEntry, removeEntry, updateEntryTeam, withValidProfiles } from './followed';
import { addProfile, applyPreset, deleteProfile, profilesStore, setTier, setValue } from './profiles';
import { setTheme, themeStore } from './theme';
import { reloadAllStores } from './store';

const purdy = (profileId: string): FollowedEntry => ({
  kind: 'player', espnId: '4361741', name: 'Brock Purdy', teamId: '25', teamAbbr: 'SF', position: 'QB', jersey: '13', profileId,
});
const profile = (id: string, name: string): Profile => ({ id, name, preset: 'ppr', values: copyValues(PRESETS.ppr) });
const seedProfiles = (...ps: Profile[]) => {
  localStorage.setItem('nflsw:v1:profiles', JSON.stringify(ps));
  reloadAllStores();
};

describe('store loading', () => {
  it('creates one PPR profile named My league on first run', () => {
    const [p] = profilesStore.get();
    expect(profilesStore.get()).toHaveLength(1);
    expect(p?.name).toBe('My league');
    expect(p?.preset).toBe('ppr');
  });

  it('persists and reloads', () => {
    addEntry(purdy('p1'));
    reloadAllStores();
    expect(followedStore.get()).toEqual([purdy('p1')]);
  });

  it('falls back to defaults on corrupt JSON and on the wrong shape', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('nflsw:v1:followed', '{');
    localStorage.setItem('nflsw:v1:profiles', JSON.stringify({ a: 1 }));
    reloadAllStores();
    expect(followedStore.get()).toEqual([]);
    expect(profilesStore.get()[0]?.name).toBe('My league');
    expect(warn).toHaveBeenCalled();
  });

  it('fills scoring fields missing from stored profiles with PPR defaults', () => {
    const { dstTd: _omit, ...partial } = PRESETS.ppr;
    localStorage.setItem('nflsw:v1:profiles', JSON.stringify([{ id: 'p1', name: 'Old', preset: 'custom', values: partial }]));
    reloadAllStores();
    expect(profilesStore.get()[0]?.values.dstTd).toBe(6);
  });
});

describe('followed entries', () => {
  it('ignores an exact duplicate but allows the same player in another profile', () => {
    addEntry(purdy('p1'));
    addEntry(purdy('p1'));
    addEntry(purdy('p2'));
    expect(followedStore.get().map((e) => e.profileId)).toEqual(['p1', 'p2']);
  });

  it('removes one entry', () => {
    addEntry(purdy('p1'));
    addEntry(purdy('p2'));
    removeEntry(purdy('p1'));
    expect(followedStore.get()).toEqual([purdy('p2')]);
  });

  it('moves an entry, merging into an existing one in the target profile', () => {
    addEntry(purdy('p1'));
    moveEntry(purdy('p1'), 'p2');
    expect(followedStore.get()).toEqual([purdy('p2')]);
    addEntry(purdy('p1'));
    moveEntry(purdy('p1'), 'p2');
    expect(followedStore.get()).toEqual([purdy('p2')]);
  });

  it('updates the team of every entry for a traded player', () => {
    addEntry(purdy('p1'));
    addEntry(purdy('p2'));
    updateEntryTeam('4361741', { teamId: '7', teamAbbr: 'DEN', position: 'QB', jersey: '10' });
    expect(followedStore.get().every((e) => e.teamAbbr === 'DEN' && e.jersey === '10')).toBe(true);
  });

  it('moves entries of unknown profiles to the first profile without duplicating', () => {
    expect(withValidProfiles([purdy('gone'), purdy('p1')], ['p1', 'p2'])).toEqual([purdy('p1')]);
  });
});

describe('profiles', () => {
  it('adds a PPR profile and returns its id', () => {
    const id = addProfile('Friends league');
    expect(profilesStore.get().find((p) => p.id === id)?.name).toBe('Friends league');
  });

  it('marks a profile custom when a value changes', () => {
    const id = profilesStore.get()[0]!.id;
    setValue(id, 'passTd', 6);
    setTier(id, 0, 12);
    const p = profilesStore.get()[0]!;
    expect(p.values.passTd).toBe(6);
    expect(p.values.pointsAllowed[0]).toBe(12);
    expect(p.preset).toBe('custom');
  });

  it('applies a preset', () => {
    const id = profilesStore.get()[0]!.id;
    setValue(id, 'passTd', 6);
    applyPreset(id, 'standard');
    const p = profilesStore.get()[0]!;
    expect(p.preset).toBe('standard');
    expect(p.values.reception).toBe(0);
    expect(p.values.passTd).toBe(4);
  });

  it('refuses to delete the last profile', () => {
    const id = profilesStore.get()[0]!.id;
    expect(deleteProfile(id, id)).toBe(false);
    expect(profilesStore.get()).toHaveLength(1);
  });

  it('drops duplicates when reassigning entries of a deleted profile', () => {
    seedProfiles(profile('p1', 'Office'), profile('p2', 'Friends'));
    addEntry(purdy('p1'));
    addEntry(purdy('p2'));
    expect(deleteProfile('p1', 'p2')).toBe(true);
    expect(profilesStore.get().map((p) => p.id)).toEqual(['p2']);
    expect(followedStore.get()).toEqual([purdy('p2')]);
  });
});

describe('theme', () => {
  it('stores the theme and applies it to the document', () => {
    expect(themeStore.get()).toBeNull();
    setTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    reloadAllStores();
    expect(themeStore.get()).toBe('dark');
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run src/storage`
Expected: FAIL, cannot resolve `./followed`.

- [ ] **Step 3: Write `src/storage/store.ts`**

```ts
export interface Store<T> {
  get(): T;
  set(next: T): void;
  subscribe(listener: () => void): () => void;
  reload(): void;
}

const registry = new Set<Store<unknown>>();

/** Reload every store from localStorage. Used by tests after seeding storage. */
export function reloadAllStores() {
  registry.forEach((s) => s.reload());
}

export function createStore<T>(opts: {
  key: string;
  fallback: () => T;
  isValid: (value: unknown) => value is T;
  repair?: (value: T) => T;
}): Store<T> {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  function load(): T {
    try {
      const raw = localStorage.getItem(opts.key);
      if (raw === null) return opts.fallback();
      const parsed: unknown = JSON.parse(raw);
      if (opts.isValid(parsed)) return opts.repair ? opts.repair(parsed) : parsed;
    } catch {
      // unreadable JSON or blocked storage: fall through to defaults
    }
    console.warn(`Stat Watch: stored data in ${opts.key} is invalid, using defaults`);
    return opts.fallback();
  }

  let value = load();
  const store: Store<T> = {
    get: () => value,
    set(next) {
      value = next;
      try {
        localStorage.setItem(opts.key, JSON.stringify(next));
      } catch {
        // storage full or blocked: keep the in-memory value
      }
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    reload() {
      value = load();
      notify();
    },
  };
  registry.add(store as Store<unknown>);
  return store;
}
```

- [ ] **Step 4: Write `src/storage/followed.ts`**

```ts
import { createStore } from './store';
import type { FollowedEntry } from './types';

const isStr = (v: unknown): v is string => typeof v === 'string';

function isEntry(v: unknown): v is FollowedEntry {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    (e.kind === 'player' || e.kind === 'defense') &&
    [e.espnId, e.name, e.teamId, e.teamAbbr, e.position, e.profileId].every(isStr) &&
    (e.jersey === undefined || isStr(e.jersey))
  );
}

export const followedStore = createStore<FollowedEntry[]>({
  key: 'nflsw:v1:followed',
  fallback: () => [],
  isValid: (v): v is FollowedEntry[] => Array.isArray(v) && v.every(isEntry),
});

type EntryKey = Pick<FollowedEntry, 'kind' | 'espnId' | 'profileId'>;

export const sameEntry = (a: EntryKey, b: EntryKey) =>
  a.kind === b.kind && a.espnId === b.espnId && a.profileId === b.profileId;

function dedupe(entries: FollowedEntry[]): FollowedEntry[] {
  return entries.filter((e, i) => entries.findIndex((x) => sameEntry(x, e)) === i);
}

export function addEntry(entry: FollowedEntry) {
  const list = followedStore.get();
  if (!list.some((e) => sameEntry(e, entry))) followedStore.set([...list, entry]);
}

export function removeEntry(entry: EntryKey) {
  followedStore.set(followedStore.get().filter((e) => !sameEntry(e, entry)));
}

export function moveEntry(entry: EntryKey, toProfileId: string) {
  followedStore.set(dedupe(followedStore.get().map((e) => (sameEntry(e, entry) ? { ...e, profileId: toProfileId } : e))));
}

export function updateEntryTeam(
  espnId: string,
  patch: Pick<FollowedEntry, 'teamId' | 'teamAbbr' | 'position' | 'jersey'>,
) {
  followedStore.set(followedStore.get().map((e) => (e.kind === 'player' && e.espnId === espnId ? { ...e, ...patch } : e)));
}

export function reassignProfile(fromId: string, toId: string) {
  followedStore.set(dedupe(followedStore.get().map((e) => (e.profileId === fromId ? { ...e, profileId: toId } : e))));
}

/** Entries that point at a profile that no longer exists move to the first profile. */
export function withValidProfiles(entries: FollowedEntry[], profileIds: string[]): FollowedEntry[] {
  const first = profileIds[0] ?? '';
  return dedupe(entries.map((e) => (profileIds.includes(e.profileId) ? e : { ...e, profileId: first })));
}
```

- [ ] **Step 5: Write `src/storage/profiles.ts`**

```ts
import { PRESETS, copyValues } from '../scoring/presets';
import type { PresetId, Profile, ScoringValues } from '../scoring/types';
import { reassignProfile } from './followed';
import { createStore } from './store';

const newProfile = (name: string): Profile => ({ id: crypto.randomUUID(), name, preset: 'ppr', values: copyValues(PRESETS.ppr) });

function isProfile(v: unknown): v is Profile {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return typeof p.id === 'string' && typeof p.name === 'string' && typeof p.preset === 'string' && typeof p.values === 'object' && p.values !== null;
}

/** Keeps stored profiles usable when new scoring fields are added later. */
function repairValues(stored: Partial<ScoringValues>): ScoringValues {
  const values = copyValues(PRESETS.ppr);
  for (const key of Object.keys(values) as (keyof ScoringValues)[]) {
    const v = stored[key];
    if (key === 'pointsAllowed') {
      if (Array.isArray(v) && v.length === 7 && v.every((n) => typeof n === 'number')) values.pointsAllowed = [...v];
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      values[key] = v;
    }
  }
  return values;
}

export const profilesStore = createStore<Profile[]>({
  key: 'nflsw:v1:profiles',
  fallback: () => [newProfile('My league')],
  isValid: (v): v is Profile[] => Array.isArray(v) && v.length > 0 && v.every(isProfile),
  repair: (ps) => ps.map((p) => ({ ...p, values: repairValues(p.values) })),
});

function update(id: string, change: (p: Profile) => Profile) {
  profilesStore.set(profilesStore.get().map((p) => (p.id === id ? change(p) : p)));
}

export function addProfile(name: string): string {
  const p = newProfile(name);
  profilesStore.set([...profilesStore.get(), p]);
  return p.id;
}

export function renameProfile(id: string, name: string) {
  update(id, (p) => ({ ...p, name }));
}

export function deleteProfile(id: string, moveTo: string): boolean {
  const list = profilesStore.get();
  if (list.length <= 1 || id === moveTo || !list.some((p) => p.id === moveTo)) return false;
  reassignProfile(id, moveTo);
  profilesStore.set(list.filter((p) => p.id !== id));
  return true;
}

export function setValue(id: string, key: Exclude<keyof ScoringValues, 'pointsAllowed'>, value: number) {
  update(id, (p) => ({ ...p, preset: 'custom', values: { ...p.values, [key]: value } }));
}

export function setTier(id: string, index: number, value: number) {
  update(id, (p) => ({
    ...p,
    preset: 'custom',
    values: { ...p.values, pointsAllowed: p.values.pointsAllowed.map((v, i) => (i === index ? value : v)) },
  }));
}

export function applyPreset(id: string, preset: PresetId) {
  update(id, (p) => ({ ...p, preset, values: copyValues(PRESETS[preset]) }));
}
```

- [ ] **Step 6: Write `src/storage/theme.ts` and `src/storage/useStore.ts`**

`src/storage/theme.ts`:

```ts
import { createStore } from './store';

export type Theme = 'light' | 'dark';

export const themeStore = createStore<Theme | null>({
  key: 'nflsw:v1:theme',
  fallback: () => null,
  isValid: (v): v is Theme | null => v === 'light' || v === 'dark' || v === null,
});

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  themeStore.set(theme);
}
```

`src/storage/useStore.ts`:

```ts
import { useSyncExternalStore } from 'react';
import type { Store } from './store';

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
```

- [ ] **Step 7: Reload stores after each test in `src/test/setup.ts`**

Add the import below the existing imports:

```ts
import { reloadAllStores } from '../storage/store';
```

Change the `afterEach` block to:

```ts
afterEach(() => {
  cleanup();
  localStorage.clear();
  reloadAllStores();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
```

- [ ] **Step 8: Run the tests and see them pass**

Run: `npm test`
Expected: all tests pass, including Tasks 1 to 4.

- [ ] **Step 9: Commit**

```bash
git add src/storage src/test/setup.ts
git commit -m "feat: add validated localStorage stores for players, profiles and theme"
```

---

### Task 6: Scoreboard mapping and data hooks

**Files:**
- Create: `src/stats/scoreboard.ts`, `src/stats/scoreboard.test.ts`, `src/hooks/queries.ts`, `src/hooks/queries.test.ts`

**Interfaces:**
- Consumes: `EspnScoreboard`, `EspnCompetitor` (Task 2), client functions (Task 2), `normalizeSummary` (Task 3).
- Produces:
  - `scoreboard.ts`: `interface TeamSide { id: string; abbr: string; color: string; score: number }`, `interface GameInfo { eventId: string; state: 'pre' | 'in' | 'post'; period: number; clock: string; kickoff: string; home: TeamSide; away: TeamSide }`, `toGames(sb: EspnScoreboard): GameInfo[]`, `gameForTeam(games: GameInfo[], teamId: string): GameInfo | null`
  - `queries.ts`: `useScoreboard()`, `useGameSummary(game: GameInfo | null)`, `useAthlete(id: string | undefined)`, `useTeams()`, `usePlayerSearch(query: string)`, `useDebounced<T>(value: T, ms?: number): T`, `scoreboardInterval(games: GameInfo[] | undefined): number`, `summaryPolling(state: GameInfo['state'] | undefined): { enabled: boolean; refetchInterval: number | false; staleTime: number }`, `freshness(isError: boolean, dataUpdatedAt: number): string | null`

- [ ] **Step 1: Write the failing test `src/stats/scoreboard.test.ts`**

```ts
import type { EspnScoreboard } from '../espn/types';
import { gameForTeam, toGames } from './scoreboard';

const sb: EspnScoreboard = {
  events: [
    {
      id: '401872975',
      date: '2026-10-04T20:25Z',
      status: { period: 2, displayClock: '6:41', type: { state: 'in', completed: false, shortDetail: '6:41 - 2nd' } },
      competitions: [{ competitors: [
        { homeAway: 'home', score: '10', team: { id: '25', abbreviation: 'SF', displayName: 'San Francisco 49ers', color: 'aa0000' } },
        { homeAway: 'away', score: '3', team: { id: '7', abbreviation: 'DEN', displayName: 'Denver Broncos' } },
      ] }],
    },
    { id: 'broken', date: '2026-10-04T20:25Z', status: { period: 0, displayClock: '0:00', type: { state: 'pre', completed: false, shortDetail: '' } }, competitions: [] },
  ],
};

describe('toGames', () => {
  it('maps events to games and skips events without two competitors', () => {
    expect(toGames(sb)).toEqual([{
      eventId: '401872975', state: 'in', period: 2, clock: '6:41', kickoff: '2026-10-04T20:25Z',
      home: { id: '25', abbr: 'SF', color: '#aa0000', score: 10 },
      away: { id: '7', abbr: 'DEN', color: '#555555', score: 3 },
    }]);
  });
});

describe('gameForTeam', () => {
  it('finds a game by home or away team, or null for a bye', () => {
    const games = toGames(sb);
    expect(gameForTeam(games, '7')?.eventId).toBe('401872975');
    expect(gameForTeam(games, '25')?.eventId).toBe('401872975');
    expect(gameForTeam(games, '12')).toBeNull();
  });
});
```

- [ ] **Step 2: Write the failing test `src/hooks/queries.test.ts`**

```ts
import type { GameInfo } from '../stats/scoreboard';
import { freshness, scoreboardInterval, summaryPolling } from './queries';

const game = (state: GameInfo['state']) => ({ state }) as GameInfo;

describe('polling rules', () => {
  it('polls the scoreboard every minute while a game is live, else every 10 minutes', () => {
    expect(scoreboardInterval([game('post'), game('in')])).toBe(60_000);
    expect(scoreboardInterval([game('pre')])).toBe(600_000);
    expect(scoreboardInterval(undefined)).toBe(600_000);
  });

  it('polls live summaries, fetches finals once and skips scheduled games', () => {
    expect(summaryPolling('in')).toEqual({ enabled: true, refetchInterval: 10_000, staleTime: 0 });
    expect(summaryPolling('post')).toEqual({ enabled: true, refetchInterval: false, staleTime: Infinity });
    expect(summaryPolling('pre')).toEqual({ enabled: false, refetchInterval: false, staleTime: 0 });
    expect(summaryPolling(undefined)).toEqual({ enabled: false, refetchInterval: false, staleTime: 0 });
  });
});

describe('freshness', () => {
  it('says nothing while requests succeed', () => expect(freshness(false, Date.now())).toBeNull());
  it('says when data was never loaded', () => expect(freshness(true, 0)).toBe('Live data unavailable, retrying'));
  it('shows the time of the last good update', () => {
    expect(freshness(true, new Date('2026-10-04T14:32:00').getTime())).toMatch(/^Updated .*32.*, retrying$/);
  });
});
```

- [ ] **Step 3: Run them and see them fail**

Run: `npx vitest run src/stats/scoreboard.test.ts src/hooks`
Expected: FAIL, cannot resolve `./scoreboard` and `./queries`.

- [ ] **Step 4: Write `src/stats/scoreboard.ts`**

```ts
import type { EspnCompetitor, EspnScoreboard } from '../espn/types';

export interface TeamSide { id: string; abbr: string; color: string; score: number }

export interface GameInfo {
  eventId: string;
  state: 'pre' | 'in' | 'post';
  period: number;
  clock: string;
  kickoff: string; // ISO date
  home: TeamSide;
  away: TeamSide;
}

const side = (c: EspnCompetitor): TeamSide => ({
  id: c.team.id,
  abbr: c.team.abbreviation,
  color: `#${c.team.color ?? '555555'}`,
  score: Number(c.score ?? 0) || 0,
});

export function toGames(sb: EspnScoreboard): GameInfo[] {
  return sb.events.flatMap((e) => {
    const comps = e.competitions[0]?.competitors ?? [];
    const home = comps.find((c) => c.homeAway === 'home');
    const away = comps.find((c) => c.homeAway === 'away');
    if (!home || !away) return [];
    return [{
      eventId: e.id,
      state: e.status.type.state,
      period: e.status.period,
      clock: e.status.displayClock,
      kickoff: e.date,
      home: side(home),
      away: side(away),
    }];
  });
}

export function gameForTeam(games: GameInfo[], teamId: string): GameInfo | null {
  return games.find((g) => g.home.id === teamId || g.away.id === teamId) ?? null;
}
```

- [ ] **Step 5: Write `src/hooks/queries.ts`**

```ts
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAthlete, getScoreboard, getSummary, getTeams, searchPlayers } from '../espn/client';
import { normalizeSummary } from '../stats/normalize';
import { toGames, type GameInfo } from '../stats/scoreboard';

export const scoreboardInterval = (games: GameInfo[] | undefined) =>
  games?.some((g) => g.state === 'in') ? 60_000 : 600_000;

export function summaryPolling(state: GameInfo['state'] | undefined): {
  enabled: boolean;
  refetchInterval: number | false;
  staleTime: number;
} {
  if (state === 'in') return { enabled: true, refetchInterval: 10_000, staleTime: 0 };
  if (state === 'post') return { enabled: true, refetchInterval: false, staleTime: Infinity };
  return { enabled: false, refetchInterval: false, staleTime: 0 };
}

export function freshness(isError: boolean, dataUpdatedAt: number): string | null {
  if (!isError) return null;
  if (!dataUpdatedAt) return 'Live data unavailable, retrying';
  const time = new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `Updated ${time}, retrying`;
}

export function useScoreboard() {
  return useQuery({
    queryKey: ['scoreboard'],
    queryFn: async () => toGames(await getScoreboard()),
    refetchInterval: (query) => scoreboardInterval(query.state.data),
  });
}

export function useGameSummary(game: GameInfo | null) {
  const polling = summaryPolling(game?.state);
  return useQuery({
    queryKey: ['summary', game?.eventId],
    queryFn: async () => normalizeSummary(await getSummary(game!.eventId)),
    enabled: polling.enabled && game !== null,
    refetchInterval: polling.refetchInterval,
    staleTime: polling.staleTime,
  });
}

export function useAthlete(id: string | undefined) {
  return useQuery({
    queryKey: ['athlete', id],
    queryFn: () => getAthlete(id!),
    enabled: id !== undefined,
    staleTime: Infinity,
    retry: 1,
  });
}

export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: getTeams,
    staleTime: Infinity,
    select: (res) => res.sports[0]?.leagues[0]?.teams.map((t) => t.team) ?? [],
  });
}

export function usePlayerSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => searchPlayers(query),
    enabled: query.length >= 2,
    staleTime: 60_000,
  });
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
```

- [ ] **Step 6: Run the tests and see them pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/stats/scoreboard.ts src/stats/scoreboard.test.ts src/hooks
git commit -m "feat: add scoreboard mapping and polling data hooks"
```

---

### Task 7: App shell, routing, theme and styles

**Files:**
- Create: `src/styles.css`, `src/ui/Header.tsx`, `src/ui/ThemeToggle.tsx`, `src/ui/MainPage.tsx` (minimal, replaced in Task 8), `src/ui/SettingsPage.tsx` (minimal, replaced in Task 10), `src/test/render.tsx`, `src/ui/shell.test.tsx`
- Modify: `src/App.tsx`, `src/main.tsx`, `index.html`
- Delete: `src/App.test.tsx` (covered by `shell.test.tsx`)

**Interfaces:**
- Consumes: `themeStore`, `setTheme`, `useStore`, `reloadAllStores` (Task 5).
- Produces: `App` (providers plus `BrowserRouter`), `AppRoutes` (routes only), `Header({ actions?: ReactNode })`, `ThemeToggle()`, test helpers `renderAt(path?: string)` and `seed(followed, profiles)` in `src/test/render.tsx`. The CSS class names in `styles.css` used by Tasks 8 to 10.

- [ ] **Step 1: Write `src/test/render.tsx`**

```tsx
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { AppRoutes } from '../App';
import type { Profile } from '../scoring/types';
import { reloadAllStores } from '../storage/store';
import type { FollowedEntry } from '../storage/types';

export function renderAt(path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

export function seed(followed: FollowedEntry[], profiles: Profile[]) {
  localStorage.setItem('nflsw:v1:followed', JSON.stringify(followed));
  localStorage.setItem('nflsw:v1:profiles', JSON.stringify(profiles));
  reloadAllStores();
}
```

- [ ] **Step 2: Write the failing test `src/ui/shell.test.tsx` and delete `src/App.test.tsx`**

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderAt } from '../test/render';

describe('app shell', () => {
  it('shows the app name and navigates to settings and back', async () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: 'Stat Watch', level: 1 })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Settings' }));
    expect(screen.getByRole('heading', { name: 'Scoring profiles' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Players' }));
    expect(screen.queryByRole('heading', { name: 'Scoring profiles' })).not.toBeInTheDocument();
  });

  it('toggles and stores the theme', async () => {
    document.documentElement.dataset.theme = 'light';
    renderAt('/');
    await userEvent.click(screen.getByRole('button', { name: 'Dark mode' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('nflsw:v1:theme')).toBe('"dark"');
    expect(screen.getByRole('button', { name: 'Light mode' })).toBeInTheDocument();
  });
});
```

```bash
git rm src/App.test.tsx
```

- [ ] **Step 3: Run it and see it fail**

Run: `npx vitest run src/ui`
Expected: FAIL, `AppRoutes` is not exported from `../App`.

- [ ] **Step 4: Write `src/ui/ThemeToggle.tsx` and `src/ui/Header.tsx`**

`src/ui/ThemeToggle.tsx`:

```tsx
import { setTheme, themeStore } from '../storage/theme';
import { useStore } from '../storage/useStore';

export function ThemeToggle() {
  useStore(themeStore); // re-render when the theme changes
  const dark = document.documentElement.dataset.theme === 'dark';
  return (
    <button type="button" className="btn press" onClick={() => setTheme(dark ? 'light' : 'dark')}>
      {dark ? 'Light mode' : 'Dark mode'}
    </button>
  );
}
```

`src/ui/Header.tsx`:

```tsx
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { ThemeToggle } from './ThemeToggle';

export function Header({ actions }: { actions?: ReactNode }) {
  return (
    <header className="wrap top">
      <h1 className="brand">Stat Watch</h1>
      <nav className="nav" aria-label="Main">
        <NavLink to="/" end>Players</NavLink>
        <NavLink to="/settings">Settings</NavLink>
      </nav>
      <ThemeToggle />
      {actions}
    </header>
  );
}
```

- [ ] **Step 5: Write minimal pages (replaced in Tasks 8 and 10)**

`src/ui/MainPage.tsx`:

```tsx
import { Header } from './Header';

export function MainPage() {
  return (
    <>
      <Header />
      <main className="wrap" />
    </>
  );
}
```

`src/ui/SettingsPage.tsx`:

```tsx
import { Header } from './Header';

export function SettingsPage() {
  return (
    <>
      <Header />
      <main className="wrap">
        <h2 className="section-title">Scoring profiles</h2>
      </main>
    </>
  );
}
```

- [ ] **Step 6: Rewrite `src/App.tsx` and update `src/main.tsx`**

`src/App.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router';
import { MainPage } from './ui/MainPage';
import { SettingsPage } from './ui/SettingsPage';

const queryClient = new QueryClient();

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MainPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

`src/main.tsx`: add `import './styles.css';` as the first line.

- [ ] **Step 7: Add fonts and the no-flash theme script to `index.html`**

Replace the `<head>` element with:

```html
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Stat Watch</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Anybody:wdth,wght@50..150,400..900&family=Hanken+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />
    <script>
      try {
        var t = JSON.parse(localStorage.getItem('nflsw:v1:theme') || 'null');
        document.documentElement.dataset.theme =
          t === 'light' || t === 'dark' ? t : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } catch (e) {
        document.documentElement.dataset.theme = 'light';
      }
    </script>
  </head>
```

- [ ] **Step 8: Write `src/styles.css`**

Tokens and layout come from the Field prototype. The light `--pylon` is darkened from the prototype to `#C2410C` so "Red zone" text meets AA on white.

```css
:root {
  --bg: #E8F0E4; --panel: #FFFFFF; --ink: #132016; --muted: #4F6555; --rule: #D2DFCD;
  --turf: #3B8A46; --turf2: #357F40; --pylon: #C2410C; --accent: #14532D; --accent-ink: #FFFFFF;
  --danger: #B42318; --bump: rgba(255, 106, 19, .28); --focus: #14532D;
  color-scheme: light;
}
[data-theme="dark"] {
  --bg: #0B1810; --panel: #122319; --ink: #E5EFE6; --muted: #9CB3A1; --rule: #21382A;
  --turf: #1F5A2A; --turf2: #1B5126; --pylon: #FF7A2E; --accent: #86EFAC; --accent-ink: #0B1810;
  --danger: #F97066; --bump: rgba(255, 106, 19, .32); --focus: #86EFAC;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.45 'Hanken Grotesk', sans-serif; min-height: 100vh; }
button, input, select { font: inherit; color: inherit; }
a { color: inherit; }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.muted { color: var(--muted); }
.wrap { max-width: 1180px; margin: 0 auto; padding: 0 20px; }
main.wrap { padding-bottom: 48px; }

/* Header */
.top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding-top: 22px; padding-bottom: 6px; }
.brand { font: 900 30px/1 Anybody, sans-serif; font-stretch: 140%; margin: 0; flex: 1; letter-spacing: -.01em; }
.nav { display: flex; gap: 14px; margin-right: 8px; }
.nav a { text-decoration: none; color: var(--muted); font-weight: 700; padding: 4px 2px; }
.nav a[aria-current="page"] { color: var(--ink); box-shadow: inset 0 -2px 0 var(--accent); }
.btn { font-weight: 700; font-size: 14px; line-height: 1; border-radius: 999px; padding: 11px 16px; cursor: pointer; border: 1px solid var(--rule); background: var(--panel); }
.btn-primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.btn-danger { color: var(--danger); }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.press { transition: transform 120ms ease-out; }
.press:active { transform: scale(.97); }
.section-title { font: 800 17px/1 Anybody, sans-serif; font-stretch: 120%; margin: 26px 0 12px; color: var(--muted); }
.page-note { color: var(--muted); font-size: 13px; margin: 8px 0 0; }

/* Cards */
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr)); gap: 14px; list-style: none; margin: 0; padding: 0; }
.grid.live { grid-template-columns: repeat(auto-fill, minmax(min(470px, 100%), 1fr)); }
.card { background: var(--panel); border: 1px solid var(--rule); border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.card.is-rz { border-color: var(--pylon); box-shadow: 0 0 0 1px var(--pylon); }
.hd { display: flex; align-items: center; gap: 12px; }
.badge { width: 42px; height: 42px; border-radius: 50%; background: var(--team); color: var(--team-ink); display: grid; place-items: center; font: 800 13px/1 Anybody, sans-serif; font-stretch: 110%; flex: none; }
.id { flex: 1; min-width: 0; }
.nm { font: 800 19px/1.15 Anybody, sans-serif; font-stretch: 108%; margin: 0; }
.live .nm { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sub { color: var(--muted); font-size: 13px; display: flex; gap: 10px; flex-wrap: wrap; }
.chip { font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: var(--bg); color: var(--ink); }
.pts { border: 0; background: none; cursor: pointer; text-align: right; padding: 2px 4px; border-radius: 8px; }
.pts b { display: block; font: 900 28px/1 Anybody, sans-serif; font-stretch: 115%; font-variant-numeric: tabular-nums; border-radius: 6px; }
.live .pts b { font-size: 38px; font-stretch: 135%; }
.pts span { font-size: 12px; color: var(--muted); }
.field { position: relative; height: 46px; border-radius: 8px; overflow: hidden; background: repeating-linear-gradient(90deg, var(--turf) 0 4.1667%, var(--turf2) 4.1667% 8.3333%); }
.ez { position: absolute; top: 0; bottom: 0; width: 8.3333%; display: grid; place-items: center; font: 800 11px/1 Anybody, sans-serif; }
.ez.l { left: 0; background: var(--own); color: var(--own-ink); }
.ez.r { right: 0; background: var(--opp); color: var(--opp-ink); }
.rzone { position: absolute; top: 0; bottom: 0; left: 75%; width: 16.6667%; background: repeating-linear-gradient(135deg, transparent 0 6px, rgba(255, 106, 19, .4) 6px 8px); }
.ballrail { position: absolute; inset: 0; transition: transform 600ms cubic-bezier(.645, .045, .355, 1); }
.los { position: absolute; top: 0; bottom: 0; left: 0; width: 2px; background: #5BB8FF; }
.ball { position: absolute; top: 50%; left: -7px; width: 15px; height: 10px; margin-top: -5px; border-radius: 50%; background: #7B3F1D; box-shadow: 0 0 0 2px rgba(255, 255, 255, .85); }
.dd { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; color: var(--muted); flex-wrap: wrap; }
.dd b { color: var(--ink); }
.rzt { color: var(--pylon); font-weight: 800; }
.score { font-size: 14px; color: var(--muted); }
.stats { display: flex; flex-wrap: wrap; gap: 8px 18px; }
.stat b { display: block; font: 800 20px/1.1 Anybody, sans-serif; font-stretch: 115%; font-variant-numeric: tabular-nums; border-radius: 4px; }
.stat span { font-size: 12px; color: var(--muted); }
.brk { border-top: 1px solid var(--rule); padding-top: 10px; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 2px 20px; font-size: 13px; margin: 0; }
.brk div { display: flex; justify-content: space-between; }
.brk dd { margin: 0; font-weight: 700; }
.note { font-size: 12px; color: var(--muted); margin: 0; }
.ft { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 13px; }
.ft label { display: flex; align-items: center; gap: 6px; color: var(--muted); }
.ft select { padding: 4px 8px; border-radius: 8px; border: 1px solid var(--rule); background: var(--bg); }
.rm { border: 0; background: none; color: var(--muted); cursor: pointer; font-size: 13px; text-decoration: underline; padding: 0; }
.empty { background: var(--panel); border-radius: 16px; padding: 40px; text-align: center; margin-top: 24px; }

/* Changed numbers */
.bump { animation: bump 900ms ease-out; }
@keyframes bump { from { background: var(--bump); } to { background: transparent; } }

/* Add dialog */
dialog { border: 0; padding: 0; border-radius: 12px; width: min(560px, calc(100vw - 32px)); background: var(--panel); color: var(--ink); box-shadow: 0 20px 60px rgba(0, 0, 0, .35); }
dialog::backdrop { background: rgba(5, 10, 20, .5); }
dialog[open] { animation: dlg 180ms ease-out; }
@keyframes dlg { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: none; } }
.dlg { padding: 20px; display: grid; gap: 14px; }
.dlg-head { display: flex; align-items: center; justify-content: space-between; }
.dlg-head h2 { margin: 0; font: 800 20px/1.2 Anybody, sans-serif; font-stretch: 115%; }
.close { border: 0; background: none; font-size: 24px; cursor: pointer; line-height: 1; padding: 4px 8px; border-radius: 6px; }
.field-label { display: grid; gap: 5px; font-size: 13px; color: var(--muted); }
.field-label input, .field-label select { font-size: 16px; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--rule); background: var(--bg); color: var(--ink); }
.results { list-style: none; margin: 0; padding: 0; max-height: 320px; overflow: auto; }
.results li { display: flex; align-items: center; gap: 10px; padding: 8px 6px; border-bottom: 1px solid var(--rule); }
.results .r { flex: 1; }
.results small { color: var(--muted); margin-left: 6px; }
.add { border: 1px solid var(--rule); background: var(--bg); border-radius: 8px; padding: 8px 12px; cursor: pointer; font-weight: 700; }
.add:disabled { opacity: .55; cursor: default; }

/* Settings */
.settings-grid { display: grid; grid-template-columns: 240px 1fr; gap: 24px; align-items: start; }
.profile-list { list-style: none; margin: 0 0 12px; padding: 0; display: grid; gap: 4px; }
.profile-list button { width: 100%; text-align: left; border: 1px solid transparent; background: none; padding: 10px 12px; border-radius: 10px; cursor: pointer; font-weight: 700; }
.profile-list button[aria-current="true"] { background: var(--panel); border-color: var(--rule); }
.profile-form { background: var(--panel); border: 1px solid var(--rule); border-radius: 16px; padding: 20px; display: grid; gap: 18px; }
.profile-form fieldset { border: 1px solid var(--rule); border-radius: 12px; padding: 12px 16px 16px; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px 16px; }
.profile-form legend { font: 800 15px/1 Anybody, sans-serif; font-stretch: 115%; padding: 0 6px; }
.num-field { display: grid; gap: 4px; font-size: 13px; color: var(--muted); }
.num-field input { padding: 8px 10px; border-radius: 8px; border: 1px solid var(--rule); background: var(--bg); color: var(--ink); font-variant-numeric: tabular-nums; }
.confirm { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 12px; border: 1px solid var(--danger); border-radius: 12px; }
@media (max-width: 760px) { .settings-grid { grid-template-columns: 1fr; } }

@media (prefers-reduced-motion: reduce) {
  .bump, dialog[open] { animation: none; }
  .ballrail, .press { transition: none; }
}
```

- [ ] **Step 9: Run tests and build**

Run: `npm test && npm run build`
Expected: all tests pass; build succeeds.

- [ ] **Step 10: Commit**

```bash
git add index.html src
git commit -m "feat: add app shell with routing, theme toggle and Field styles"
```

---

### Task 8: Main screen and player cards

**Files:**
- Create: `src/ui/format.ts`, `src/ui/format.test.ts`, `src/ui/Bump.tsx`, `src/ui/MiniField.tsx`, `src/ui/EntryCard.tsx`, `src/test/mockFetch.ts`, `src/test/data.ts`, `src/ui/MainPage.test.tsx`
- Modify: `src/ui/MainPage.tsx` (replace the Task 7 version)

**Interfaces:**
- Consumes: `useScoreboard`, `useGameSummary`, `useAthlete`, `freshness` (Task 6); `GameInfo`, `gameForTeam` (Task 6); `scoreEntry`, `PRESETS`, `copyValues` (Task 4); stores and actions (Task 5); `Header` (Task 7); `renderAt`, `seed` (Task 7).
- Produces:
  - `format.ts`: `type StatItem = { value: string; label: string }`, `isOffense(position: string): boolean`, `statLine(entry: FollowedEntry, game: GameStats | undefined): StatItem[]`, `isRedZone(entry: FollowedEntry, game: GameInfo | null, stats: GameStats | undefined): boolean`, `textOn(hex: string): '#ffffff' | '#111111'`, `resultText(game: GameInfo, teamId: string): string`, `kickoffText(iso: string): string`
  - `EntryCard({ entry, game, profiles, hasSchedule })`, `MiniField({ game, situation })`, `Bump({ value })`
  - `MainPage` with local `adding` state, wired to the dialog in Task 9.
  - Test helpers: `mockFetch(routes)`, `status(code)` (`src/test/mockFetch.ts`); `scoreboardFixture`, `profilesFixture`, `warren`, `pitDefense`, `mahomes` (`src/test/data.ts`).

- [ ] **Step 1: Write the failing test `src/ui/format.test.ts`**

```ts
import summaryJson from '../test/fixtures/summary-pit-cle.json';
import type { EspnSummary } from '../espn/types';
import { normalizeSummary } from '../stats/normalize';
import type { GameInfo } from '../stats/scoreboard';
import type { FollowedEntry } from '../storage/types';
import { isRedZone, resultText, statLine, textOn } from './format';

const stats = normalizeSummary(summaryJson as unknown as EspnSummary);
const entry = (over: Partial<FollowedEntry>): FollowedEntry => ({
  kind: 'player', espnId: '8439', name: 'Aaron Rodgers', teamId: '23', teamAbbr: 'PIT', position: 'QB', profileId: 'p1', ...over,
});
const line = (e: FollowedEntry) => statLine(e, stats).map((s) => `${s.value} ${s.label}`);

describe('statLine', () => {
  it('formats each position', () => {
    expect(line(entry({}))).toEqual(['22/40 comp', '299 pass yds', '3 pass TD', '2 INT', '0 rush yds']);
    expect(line(entry({ espnId: '4569987', position: 'RB' }))).toEqual(['17 carries', '93 rush yds', '3 catches', '33 rec yds', '0 TD']);
    expect(line(entry({ espnId: '4430802', position: 'TE' }))).toEqual(['3/5 catches', '27 rec yds', '1 TD']);
    expect(line(entry({ espnId: '17372', position: 'K' }))).toEqual(['1/2 FG', '31 long', '1/1 XP']);
    expect(line(entry({ espnId: '4361652', position: 'LB' }))).toEqual(['9 tackles', '1 sacks', '1 TFL', '0 PD', '0 INT']);
    expect(line(entry({ kind: 'defense', espnId: '23', position: 'D/ST' }))).toEqual(['2 sacks', '1 INT', '1 fum rec', '27 pts allowed']);
  });
  it('is empty without stats', () => {
    expect(statLine(entry({}), undefined)).toEqual([]);
    expect(statLine(entry({ espnId: '1' }), stats)).toEqual([]);
  });
});

const live: GameInfo = {
  eventId: '1', state: 'in', period: 2, clock: '6:41', kickoff: '2026-10-04T20:25Z',
  home: { id: '23', abbr: 'PIT', color: '#000000', score: 10 }, away: { id: '5', abbr: 'CLE', color: '#472a08', score: 3 },
};
const withSituation = (possessionTeamId: string, yardsToEndzone: number) => ({
  ...stats, situation: { possessionTeamId, yardsToEndzone, downDistanceText: '', lastPlayText: '' },
});

describe('isRedZone', () => {
  it('is true only for offensive players of the team with the ball inside the 20 in a live game', () => {
    expect(isRedZone(entry({}), live, withSituation('23', 12))).toBe(true);
    expect(isRedZone(entry({}), live, withSituation('23', 21))).toBe(false);
    expect(isRedZone(entry({}), live, withSituation('5', 12))).toBe(false);
    expect(isRedZone(entry({ position: 'LB' }), live, withSituation('23', 12))).toBe(false);
    expect(isRedZone(entry({}), { ...live, state: 'post' }, withSituation('23', 12))).toBe(false);
  });
});

describe('textOn', () => {
  it('picks readable text for dark and light team colors', () => {
    expect(textOn('#000000')).toBe('#ffffff');
    expect(textOn('#aa0000')).toBe('#ffffff');
    expect(textOn('#d3bc8d')).toBe('#111111'); // Saints gold
    expect(textOn('#ffb612')).toBe('#111111');
  });
});

describe('resultText', () => {
  it('describes a final from the team perspective', () => {
    const final = { ...live, state: 'post' as const, home: { ...live.home, score: 24 }, away: { ...live.away, score: 27 } };
    expect(resultText(final, '23')).toBe('Lost 24-27 vs CLE');
    expect(resultText(final, '5')).toBe('Won 27-24 at PIT');
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run src/ui/format.test.ts`
Expected: FAIL, cannot resolve `./format`.

- [ ] **Step 3: Write `src/ui/format.ts`**

```ts
import type { GameStats } from '../stats/types';
import type { GameInfo } from '../stats/scoreboard';
import type { FollowedEntry } from '../storage/types';

export type StatItem = { value: string; label: string };

const OFFENSE = new Set(['QB', 'RB', 'FB', 'WR', 'TE', 'K', 'PK']);
export const isOffense = (position: string) => OFFENSE.has(position);

const items = (pairs: [number | string, string][]): StatItem[] => pairs.map(([v, label]) => ({ value: String(v), label }));

export function statLine(entry: FollowedEntry, game: GameStats | undefined): StatItem[] {
  if (!game) return [];
  if (entry.kind === 'defense') {
    const d = game.defenses[entry.teamId];
    return d ? items([[d.sacks, 'sacks'], [d.interceptions, 'INT'], [d.fumbleRecoveries, 'fum rec'], [d.pointsAllowed, 'pts allowed']]) : [];
  }
  const s = game.players[entry.espnId];
  if (!s) return [];
  const rec = s.receiving ?? { receptions: 0, targets: 0, yards: 0, touchdowns: 0 };
  const rush = s.rushing ?? { attempts: 0, yards: 0, touchdowns: 0 };
  switch (entry.position) {
    case 'QB': {
      const p = s.passing ?? { completions: 0, attempts: 0, yards: 0, touchdowns: 0, interceptions: 0 };
      return items([[`${p.completions}/${p.attempts}`, 'comp'], [p.yards, 'pass yds'], [p.touchdowns, 'pass TD'], [p.interceptions, 'INT'], [rush.yards, 'rush yds']]);
    }
    case 'RB':
    case 'FB':
      return items([[rush.attempts, 'carries'], [rush.yards, 'rush yds'], [rec.receptions, 'catches'], [rec.yards, 'rec yds'], [rush.touchdowns + rec.touchdowns, 'TD']]);
    case 'WR':
    case 'TE':
      return items([[`${rec.receptions}/${rec.targets}`, 'catches'], [rec.yards, 'rec yds'], [rec.touchdowns, 'TD']]);
    case 'K':
    case 'PK': {
      const k = s.kicking ?? { fgMade: 0, fgAttempts: 0, longest: 0, xpMade: 0, xpAttempts: 0, madeDistances: [] };
      return items([[`${k.fgMade}/${k.fgAttempts}`, 'FG'], [k.longest, 'long'], [`${k.xpMade}/${k.xpAttempts}`, 'XP']]);
    }
    default: {
      const d = s.defense ?? { totalTackles: 0, soloTackles: 0, sacks: 0, tacklesForLoss: 0, passesDefended: 0, qbHits: 0, touchdowns: 0 };
      return items([[d.totalTackles, 'tackles'], [d.sacks, 'sacks'], [d.tacklesForLoss, 'TFL'], [d.passesDefended, 'PD'], [s.interceptions?.interceptions ?? 0, 'INT']]);
    }
  }
}

export function isRedZone(entry: FollowedEntry, game: GameInfo | null, stats: GameStats | undefined): boolean {
  const s = stats?.situation;
  return (
    entry.kind === 'player' && isOffense(entry.position) && game?.state === 'in' &&
    !!s && s.possessionTeamId === entry.teamId && s.yardsToEndzone <= 20
  );
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** White or near-black text, whichever has more contrast on the team color. */
export function textOn(hex: string): '#ffffff' | '#111111' {
  const l = luminance(hex);
  const onWhite = 1.05 / (l + 0.05);
  const onDark = (l + 0.05) / (luminance('#111111') + 0.05);
  return onWhite >= onDark ? '#ffffff' : '#111111';
}

export function resultText(game: GameInfo, teamId: string): string {
  const home = game.home.id === teamId;
  const us = home ? game.home : game.away;
  const them = home ? game.away : game.home;
  const verb = us.score > them.score ? 'Won' : us.score < them.score ? 'Lost' : 'Tied';
  return `${verb} ${us.score}-${them.score} ${home ? 'vs' : 'at'} ${them.abbr}`;
}

export const kickoffText = (iso: string) =>
  new Date(iso).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
```

- [ ] **Step 4: Run it and see it pass**

Run: `npx vitest run src/ui/format.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Write test helpers `src/test/mockFetch.ts` and `src/test/data.ts`**

`src/test/mockFetch.ts`:

```ts
import { vi } from 'vitest';

export const status = (code: number) => ({ __status: code });

/** Routes fetch by URL substring, first match wins. Unmatched URLs return 404. */
export function mockFetch(routes: Record<string, unknown>) {
  const f = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (key === undefined) return new Response('not found', { status: 404 });
    const body = routes[key];
    if (typeof body === 'object' && body !== null && '__status' in body) {
      return new Response('error', { status: (body as { __status: number }).__status });
    }
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', f);
  return f;
}
```

`src/test/data.ts`:

```ts
import type { EspnScoreboard } from '../espn/types';
import { PRESETS, copyValues } from '../scoring/presets';
import type { Profile } from '../scoring/types';
import type { FollowedEntry } from '../storage/types';

export const scoreboardFixture: EspnScoreboard = {
  events: [
    {
      id: '401872964',
      date: '2026-10-02T00:15Z',
      status: { period: 4, displayClock: '0:00', type: { state: 'post', completed: true, shortDetail: 'Final' } },
      competitions: [{ competitors: [
        { homeAway: 'home', score: '27', team: { id: '5', abbreviation: 'CLE', displayName: 'Cleveland Browns', color: '472a08' } },
        { homeAway: 'away', score: '24', team: { id: '23', abbreviation: 'PIT', displayName: 'Pittsburgh Steelers', color: '000000' } },
      ] }],
    },
    {
      id: '401872975',
      date: '2026-10-04T20:25Z',
      status: { period: 0, displayClock: '0:00', type: { state: 'pre', completed: false, shortDetail: '10/4 - 4:25 PM EDT' } },
      competitions: [{ competitors: [
        { homeAway: 'home', score: '0', team: { id: '25', abbreviation: 'SF', displayName: 'San Francisco 49ers', color: 'aa0000' } },
        { homeAway: 'away', score: '0', team: { id: '7', abbreviation: 'DEN', displayName: 'Denver Broncos', color: '0a2343' } },
      ] }],
    },
  ],
};

export const profilesFixture: Profile[] = [
  { id: 'p1', name: 'Office league', preset: 'ppr', values: copyValues(PRESETS.ppr) },
  { id: 'p2', name: 'Friends league', preset: 'standard', values: copyValues(PRESETS.standard) },
];

export const warren: FollowedEntry = { kind: 'player', espnId: '4569987', name: 'Jaylen Warren', teamId: '23', teamAbbr: 'PIT', position: 'RB', jersey: '30', profileId: 'p1' };
export const pitDefense: FollowedEntry = { kind: 'defense', espnId: '23', name: 'Pittsburgh Steelers', teamId: '23', teamAbbr: 'PIT', position: 'D/ST', profileId: 'p1' };
export const mahomes: FollowedEntry = { kind: 'player', espnId: '3139477', name: 'Patrick Mahomes', teamId: '12', teamAbbr: 'KC', position: 'QB', jersey: '15', profileId: 'p2' };
```

- [ ] **Step 6: Write the failing test `src/ui/MainPage.test.tsx`**

```tsx
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import summary from '../test/fixtures/summary-pit-cle.json';
import { mahomes, pitDefense, profilesFixture, scoreboardFixture, warren } from '../test/data';
import { mockFetch, status } from '../test/mockFetch';
import { renderAt, seed } from '../test/render';

const card = (name: string) => screen.getByText(name).closest('li')!;

describe('main page', () => {
  beforeEach(() => seed([warren, pitDefense, mahomes], profilesFixture));

  it('groups entries and shows stats and fantasy points', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'summary?event=401872964': summary });
    renderAt('/');
    expect(await screen.findByText('15.60')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Final' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bye week' })).toBeInTheDocument();
    expect(within(card('Jaylen Warren')).getByText('Lost 24-27 at CLE')).toBeInTheDocument();
    expect(within(card('Jaylen Warren')).getByText('93')).toBeInTheDocument();
    expect(within(card('Pittsburgh Steelers')).getByText('6.00')).toBeInTheDocument();
    expect(within(card('Patrick Mahomes')).getByText('Bye week')).toBeInTheDocument();
  });

  it('shows the breakdown', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'summary?event=401872964': summary });
    renderAt('/');
    await userEvent.click(await screen.findByRole('button', { name: /15\.60 fantasy points in Office league/ }));
    expect(within(card('Jaylen Warren')).getByText('Rushing yards')).toBeInTheDocument();
    expect(within(card('Jaylen Warren')).getByText('+9.30')).toBeInTheDocument();
  });

  it('moves an entry to another league and rescores it', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'summary?event=401872964': summary });
    renderAt('/');
    await screen.findByText('15.60');
    await userEvent.selectOptions(within(card('Jaylen Warren')).getByLabelText('League'), 'Friends league');
    expect(within(card('Jaylen Warren')).getByText('12.60')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('nflsw:v1:followed')!)[0].profileId).toBe('p2');
  });

  it('removes an entry', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'summary?event=401872964': summary });
    renderAt('/');
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Pittsburgh Steelers from Office league' }));
    expect(screen.queryByText('Pittsburgh Steelers')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('nflsw:v1:followed')!)).toHaveLength(2);
  });

  it('shows a retry note when the game summary fails', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'summary?event=401872964': status(500) });
    renderAt('/');
    // Warren and the Steelers defense share the failing game.
    expect(await screen.findAllByText('Live data unavailable, retrying')).toHaveLength(2);
    expect(within(card('Jaylen Warren')).getByText('0.00')).toBeInTheDocument();
  });

  it('shows an empty state with nothing followed', async () => {
    seed([], profilesFixture);
    mockFetch({ scoreboard: scoreboardFixture });
    renderAt('/');
    expect(screen.getByText(/not following anyone yet/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run it and see it fail**

Run: `npx vitest run src/ui/MainPage.test.tsx`
Expected: FAIL, no "15.60" (the Task 7 page renders nothing).

- [ ] **Step 8: Write `src/ui/Bump.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';

/** Renders a value and briefly highlights it when it changes. */
export function Bump({ value }: { value: string }) {
  const previous = useRef(value);
  const [changes, setChanges] = useState(0);
  useEffect(() => {
    if (previous.current !== value) {
      previous.current = value;
      setChanges((n) => n + 1);
    }
  }, [value]);
  return (
    <b key={changes} className={changes > 0 ? 'bump' : undefined}>
      {value}
    </b>
  );
}
```

- [ ] **Step 9: Write `src/ui/MiniField.tsx`**

```tsx
import type { CSSProperties } from 'react';
import type { GameInfo } from '../stats/scoreboard';
import type { Situation } from '../stats/types';
import { textOn } from './format';

export function MiniField({ game, situation }: { game: GameInfo; situation: Situation }) {
  const offense = game.home.id === situation.possessionTeamId ? game.home : game.away;
  const defense = offense === game.home ? game.away : game.home;
  const yards = Math.min(100, Math.max(0, situation.yardsToEndzone));
  // The offense always attacks to the right; each endzone is 10 of 120 yards.
  const x = 8.3333 + (100 - yards) * 0.83333;
  const style = {
    '--own': offense.color, '--own-ink': textOn(offense.color),
    '--opp': defense.color, '--opp-ink': textOn(defense.color),
  } as CSSProperties;
  return (
    <div className="field" role="img" aria-label={`${offense.abbr} ball, ${situation.downDistanceText}`} style={style}>
      <div className="ez l">{offense.abbr}</div>
      <div className="ez r">{defense.abbr}</div>
      <div className="rzone" />
      {/* A new key on change of possession makes the ball jump instead of glide. */}
      <div key={offense.id} className="ballrail" style={{ transform: `translateX(${x}%)` }}>
        <div className="los" />
        <div className="ball" />
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Write `src/ui/EntryCard.tsx`**

```tsx
import { useEffect, useState, type CSSProperties } from 'react';
import { freshness, useAthlete, useGameSummary } from '../hooks/queries';
import { scoreEntry } from '../scoring/score';
import type { Profile } from '../scoring/types';
import type { GameInfo } from '../stats/scoreboard';
import { moveEntry, removeEntry, updateEntryTeam } from '../storage/followed';
import type { FollowedEntry } from '../storage/types';
import { Bump } from './Bump';
import { MiniField } from './MiniField';
import { isRedZone, kickoffText, resultText, statLine, textOn } from './format';

interface Props {
  entry: FollowedEntry;
  game: GameInfo | null;
  profiles: Profile[];
  hasSchedule: boolean;
}

const sign = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${Math.abs(n).toFixed(2)}`;

export function EntryCard({ entry, game, profiles, hasSchedule }: Props) {
  const summary = useGameSummary(game);
  const athlete = useAthlete(entry.kind === 'player' ? entry.espnId : undefined);
  const [open, setOpen] = useState(false);

  // Keep the stored team current, for example after a trade.
  useEffect(() => {
    const a = athlete.data?.athlete;
    if (!a?.team) return;
    const position = a.position?.abbreviation ?? entry.position;
    if (a.team.id !== entry.teamId || position !== entry.position) {
      updateEntryTeam(entry.espnId, { teamId: a.team.id, teamAbbr: a.team.abbreviation, position, jersey: a.jersey });
    }
  }, [athlete.data, entry.espnId, entry.teamId, entry.position]);

  const profile = profiles.find((p) => p.id === entry.profileId) ?? profiles[0]!;
  const stats = summary.data;
  const result = scoreEntry(entry, stats, profile.values);
  const total = result.total.toFixed(2);
  const items = statLine(entry, stats);
  const live = game?.state === 'in';
  const redZone = isRedZone(entry, game, stats);
  const home = game?.home.id === entry.teamId;
  const us = game ? (home ? game.home : game.away) : null;
  const them = game ? (home ? game.away : game.home) : null;
  const color = us?.color ?? '#555555';
  const versus = them ? `${home ? 'vs' : 'at'} ${them.abbr}` : null;
  const note = freshness(summary.isError, summary.dataUpdatedAt);
  const situation = live ? stats?.situation : null;
  const role = entry.kind === 'defense' ? 'Team defense' : entry.position;

  let status: string;
  if (!game) status = hasSchedule ? 'Bye week' : 'Game status unavailable';
  else if (game.state === 'post') status = resultText(game, entry.teamId);
  else if (game.state === 'pre') status = `Kickoff ${kickoffText(game.kickoff)}`;
  else status = `Q${game.period} ${game.clock}, ${game.away.abbr} ${game.away.score} at ${game.home.abbr} ${game.home.score}`;

  return (
    <li
      className={`card${live ? ' live' : ''}${redZone ? ' is-rz' : ''}`}
      style={{ '--team': color, '--team-ink': textOn(color) } as CSSProperties}
    >
      <div className="hd">
        <div className="badge" aria-hidden="true">{entry.teamAbbr}</div>
        <div className="id">
          <p className="nm">{entry.name}</p>
          <div className="sub">
            <span>{versus ? `${role}, ${versus}` : role}</span>
            <span className="chip">{profile.name}</span>
          </div>
        </div>
        <button
          type="button"
          className="pts press"
          aria-expanded={open}
          aria-label={`${total} fantasy points in ${profile.name}, show breakdown`}
          onClick={() => setOpen((o) => !o)}
        >
          <Bump value={total} />
          <span>fantasy pts</span>
        </button>
      </div>

      {game && situation ? (
        <>
          <MiniField game={game} situation={situation} />
          <div className="dd">
            <span><b>Q{game.period} {game.clock}</b>, {game.away.abbr} {game.away.score} at {game.home.abbr} {game.home.score}</span>
            <span>
              {redZone && <span className="rzt">Red zone </span>}
              {situation.downDistanceText}
            </span>
          </div>
          <div className="dd"><span>{situation.lastPlayText}</span></div>
        </>
      ) : (
        <div className="score">{status}</div>
      )}

      <div className="stats">
        {items.length > 0 ? (
          items.map((s) => (
            <div className="stat" key={s.label}>
              <Bump value={s.value} />
              <span>{s.label}</span>
            </div>
          ))
        ) : (
          <div className="stat"><span>{game?.state === 'pre' ? 'No stats until kickoff' : 'No stats'}</span></div>
        )}
      </div>

      {open && (
        <dl className="brk">
          {result.breakdown.length > 0 ? (
            result.breakdown.map((l) => (
              <div key={l.label}><dt>{l.label}</dt><dd>{sign(l.points)}</dd></div>
            ))
          ) : (
            <div><dt>No points yet</dt><dd>0.00</dd></div>
          )}
        </dl>
      )}

      {note && <p className="note">{note}</p>}

      <div className="ft">
        <label>
          League
          <select value={profile.id} onChange={(e) => moveEntry(entry, e.target.value)}>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <button type="button" className="rm" onClick={() => removeEntry(entry)} aria-label={`Remove ${entry.name} from ${profile.name}`}>
          Remove
        </button>
      </div>
    </li>
  );
}
```

- [ ] **Step 11: Replace `src/ui/MainPage.tsx`**

```tsx
import { useState } from 'react';
import { freshness, useScoreboard } from '../hooks/queries';
import { gameForTeam } from '../stats/scoreboard';
import { followedStore, withValidProfiles } from '../storage/followed';
import { profilesStore } from '../storage/profiles';
import { useStore } from '../storage/useStore';
import { EntryCard } from './EntryCard';
import { Header } from './Header';

const GROUPS = [
  { key: 'in', title: 'Live now' },
  { key: 'post', title: 'Final' },
  { key: 'pre', title: 'Later' },
  { key: 'none', title: 'Bye week' },
] as const;

export function MainPage() {
  const profiles = useStore(profilesStore);
  const followed = withValidProfiles(useStore(followedStore), profiles.map((p) => p.id));
  const scoreboard = useScoreboard();
  const [adding, setAdding] = useState(false);
  const hasSchedule = scoreboard.data !== undefined;
  const games = scoreboard.data ?? [];
  const rows = followed.map((entry) => ({ entry, game: gameForTeam(games, entry.teamId) }));
  const note = freshness(scoreboard.isError, scoreboard.dataUpdatedAt);

  const addButton = (
    <button type="button" className="btn btn-primary press" onClick={() => setAdding(true)}>
      Add player
    </button>
  );

  return (
    <>
      <Header actions={addButton} />
      <main className="wrap">
        {note && <p className="page-note">{note}</p>}
        {followed.length === 0 ? (
          <div className="empty">
            <p>You're not following anyone yet. Add players or team defenses from any of your leagues.</p>
            {addButton}
          </div>
        ) : (
          GROUPS.map(({ key, title }) => {
            const group = rows.filter((r) => (r.game?.state ?? 'none') === key);
            if (group.length === 0) return null;
            return (
              <section key={key} aria-labelledby={`group-${key}`}>
                <h2 className="section-title" id={`group-${key}`}>
                  {key === 'none' && !hasSchedule ? 'Followed' : title}
                </h2>
                <ul className={`grid${key === 'in' ? ' live' : ''}`}>
                  {group.map(({ entry, game }) => (
                    <EntryCard
                      key={`${entry.kind}:${entry.espnId}:${entry.profileId}`}
                      entry={entry}
                      game={game}
                      profiles={profiles}
                      hasSchedule={hasSchedule}
                    />
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </main>
      {/* Task 9 replaces this line with <AddDialog open={adding} onClose={() => setAdding(false)} />. */}
      {adding && null}
    </>
  );
}
```

- [ ] **Step 12: Run the tests and see them pass**

Run: `npm test`
Expected: all tests pass. The shell test from Task 7 still passes: storage is empty, so the page shows the empty state, and the default `fetch` stub answers 404.

- [ ] **Step 13: Commit**

```bash
git add src/ui src/test
git commit -m "feat: add main screen with live player cards, mini field and breakdowns"
```

---

### Task 9: Add dialog

**Files:**
- Create: `src/ui/AddDialog.tsx`, `src/ui/AddDialog.test.tsx`
- Modify: `src/ui/MainPage.tsx` (render the dialog)

**Interfaces:**
- Consumes: `usePlayerSearch`, `useTeams`, `useDebounced` (Task 6); `getAthlete` (Task 2); `addEntry`, `followedStore`, `profilesStore`, `useStore` (Task 5); `mockFetch`, `status`, `profilesFixture`, `scoreboardFixture` (Task 8).
- Produces: `AddDialog({ open: boolean; onClose: () => void })`.

- [ ] **Step 1: Write the failing test `src/ui/AddDialog.test.tsx`**

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import teams from '../test/fixtures/teams.json';
import { profilesFixture, scoreboardFixture } from '../test/data';
import { mockFetch, status } from '../test/mockFetch';
import { renderAt, seed } from '../test/render';

const search = {
  items: [
    { id: '3918298', displayName: 'Josh Allen', league: 'nfl' },
    { id: '4892153', displayName: 'Josh Allen', league: 'college-football' },
  ],
};
const allen = { athlete: { id: '3918298', displayName: 'Josh Allen', jersey: '17', position: { abbreviation: 'QB' }, team: { id: '2', abbreviation: 'BUF' } } };
const stored = () => JSON.parse(localStorage.getItem('nflsw:v1:followed') ?? '[]');

async function openDialog() {
  renderAt('/');
  await userEvent.click(screen.getAllByRole('button', { name: 'Add player' })[0]!);
  return screen.getByRole('dialog', { name: 'Add a player or defense' });
}

describe('add dialog', () => {
  beforeEach(() => seed([], profilesFixture));

  it('finds an NFL player, shows team and position, and adds them to the chosen league', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'search?query=josh%20allen': search, 'athletes/3918298': allen, '/teams': teams });
    await openDialog();
    await userEvent.selectOptions(screen.getByLabelText('League'), 'Friends league');
    await userEvent.type(screen.getByLabelText('Search'), 'josh allen');
    expect(await screen.findByText('BUF QB')).toBeInTheDocument();
    expect(screen.getAllByText('Josh Allen')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Add Josh Allen' }));
    expect(stored()).toEqual([{ kind: 'player', espnId: '3918298', name: 'Josh Allen', teamId: '2', teamAbbr: 'BUF', position: 'QB', jersey: '17', profileId: 'p2' }]);
    expect(screen.getByRole('button', { name: 'Josh Allen added' })).toBeDisabled();
  });

  it('finds a team defense by nickname', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'search?query=bills': { items: [] }, '/teams': teams });
    await openDialog();
    await userEvent.type(screen.getByLabelText('Search'), 'bills');
    await userEvent.click(await screen.findByRole('button', { name: 'Add Buffalo Bills' }));
    expect(stored()[0]).toMatchObject({ kind: 'defense', espnId: '2', teamId: '2', teamAbbr: 'BUF', position: 'D/ST', profileId: 'p1' });
  });

  it('says when nothing matches', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'search?query=zzzz': { items: [] }, '/teams': teams });
    await openDialog();
    await userEvent.type(screen.getByLabelText('Search'), 'zzzz');
    expect(await screen.findByText('No NFL player or team matches "zzzz".')).toBeInTheDocument();
  });

  it('explains when search is unavailable', async () => {
    mockFetch({ scoreboard: scoreboardFixture, search: status(500), '/teams': teams });
    await openDialog();
    await userEvent.type(screen.getByLabelText('Search'), 'purdy');
    expect(await screen.findByText('Search is unavailable right now. Try again in a moment.')).toBeInTheDocument();
  });

  it('closes with the close button', async () => {
    mockFetch({ scoreboard: scoreboardFixture, '/teams': teams });
    const dialog = await openDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(dialog).not.toHaveAttribute('open');
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run src/ui/AddDialog.test.tsx`
Expected: FAIL, no dialog named "Add a player or defense".

- [ ] **Step 3: Write `src/ui/AddDialog.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { getAthlete } from '../espn/client';
import type { EspnTeamRef } from '../espn/types';
import { useDebounced, usePlayerSearch, useTeams } from '../hooks/queries';
import { addEntry, followedStore } from '../storage/followed';
import { profilesStore } from '../storage/profiles';
import { useStore } from '../storage/useStore';
import type { FollowedEntry } from '../storage/types';

export function AddDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const profiles = useStore(profilesStore);
  const followed = useStore(followedStore);
  const [query, setQuery] = useState('');
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? '');
  const term = useDebounced(query.trim(), 300);
  const search = usePlayerSearch(term);
  const teams = useTeams();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const hits = search.data ?? [];
  const details = useQueries({
    queries: hits.map((h) => ({ queryKey: ['athlete', h.id], queryFn: () => getAthlete(h.id), staleTime: Infinity, retry: 1 })),
  });
  const lower = term.toLowerCase();
  const defenses: EspnTeamRef[] =
    term.length >= 2
      ? (teams.data ?? []).filter((t) => [t.displayName, t.location, t.name, t.abbreviation].some((s) => s?.toLowerCase().includes(lower)))
      : [];

  const isFollowed = (kind: FollowedEntry['kind'], espnId: string) =>
    followed.some((f) => f.kind === kind && f.espnId === espnId && f.profileId === profileId);

  function addPlayer(index: number) {
    const a = details[index]?.data?.athlete;
    if (!a?.team) return;
    addEntry({ kind: 'player', espnId: a.id, name: a.displayName, teamId: a.team.id, teamAbbr: a.team.abbreviation, position: a.position?.abbreviation ?? '', jersey: a.jersey, profileId });
  }

  function addDefense(t: EspnTeamRef) {
    addEntry({ kind: 'defense', espnId: t.id, name: t.displayName, teamId: t.id, teamAbbr: t.abbreviation, position: 'D/ST', profileId });
  }

  const addButton = (name: string, done: boolean, disabled: boolean, onClick: () => void) => (
    <button type="button" className="add press" disabled={done || disabled} onClick={onClick} aria-label={done ? `${name} added` : `Add ${name}`}>
      {done ? 'Added' : 'Add'}
    </button>
  );

  let message: string | null = null;
  if (term.length < 2) message = 'Type at least 2 letters.';
  else if (search.isError) message = 'Search is unavailable right now. Try again in a moment.';
  else if (!search.isFetching && hits.length === 0 && defenses.length === 0) message = `No NFL player or team matches "${term}".`;

  return (
    <dialog ref={ref} aria-labelledby="add-title" onClose={onClose}>
      <div className="dlg">
        <div className="dlg-head">
          <h2 id="add-title">Add a player or defense</h2>
          <button type="button" className="close" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <label className="field-label">
          Search
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or team, for example Purdy or Bills" autoComplete="off" autoFocus />
        </label>
        <label className="field-label">
          League
          <select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <ul className="results" aria-live="polite">
          {defenses.map((t) => (
            <li key={`d${t.id}`}>
              <span className="r"><b>{t.displayName}</b><small>Team defense</small></span>
              {addButton(t.displayName, isFollowed('defense', t.id), false, () => addDefense(t))}
            </li>
          ))}
          {hits.map((h, i) => {
            const a = details[i]?.data?.athlete;
            const meta = details[i]?.isPending ? 'Loading team' : a?.team ? `${a.team.abbreviation} ${a.position?.abbreviation ?? ''}`.trim() : 'Free agent';
            return (
              <li key={`p${h.id}`}>
                <span className="r"><b>{h.displayName}</b><small>{meta}</small></span>
                {addButton(h.displayName, isFollowed('player', h.id), !a?.team, () => addPlayer(i))}
              </li>
            );
          })}
          {message && <li className="muted">{message}</li>}
        </ul>
      </div>
    </dialog>
  );
}
```

- [ ] **Step 4: Render the dialog from `src/ui/MainPage.tsx`**

Add the import:

```tsx
import { AddDialog } from './AddDialog';
```

Replace these two lines:

```tsx
      {/* Task 9 replaces this line with <AddDialog open={adding} onClose={() => setAdding(false)} />. */}
      {adding && null}
```

with:

```tsx
      <AddDialog open={adding} onClose={() => setAdding(false)} />
```

- [ ] **Step 5: Run the tests and see them pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/ui
git commit -m "feat: add search dialog for players and team defenses"
```

---

### Task 10: Settings page

**Files:**
- Create: `src/scoring/fields.ts`, `src/ui/SettingsPage.test.tsx`
- Modify: `src/ui/SettingsPage.tsx` (replace the Task 7 version)

**Interfaces:**
- Consumes: `profilesStore`, `followedStore`, `addProfile`, `renameProfile`, `deleteProfile`, `setValue`, `setTier`, `applyPreset`, `useStore` (Task 5); `PRESET_LABELS`, `POINTS_ALLOWED_TIERS`, `PresetId`, `Profile`, `ScoringValues` (Task 4); test helpers (Tasks 7, 8).
- Produces: `ValueKey`, `FIELD_GROUPS` (`src/scoring/fields.ts`), `SettingsPage`.

- [ ] **Step 1: Write `src/scoring/fields.ts`**

```ts
import type { ScoringValues } from './types';

export type ValueKey = Exclude<keyof ScoringValues, 'pointsAllowed'>;

export const FIELD_GROUPS: { title: string; fields: { key: ValueKey; label: string; step: number }[] }[] = [
  {
    title: 'Offense',
    fields: [
      { key: 'passYards', label: 'Per passing yard', step: 0.01 },
      { key: 'passTd', label: 'Passing TD', step: 1 },
      { key: 'interception', label: 'Interception thrown', step: 1 },
      { key: 'rushYards', label: 'Per rushing yard', step: 0.01 },
      { key: 'rushTd', label: 'Rushing TD', step: 1 },
      { key: 'reception', label: 'Reception', step: 0.5 },
      { key: 'recYards', label: 'Per receiving yard', step: 0.01 },
      { key: 'recTd', label: 'Receiving TD', step: 1 },
      { key: 'twoPoint', label: '2-point conversion', step: 1 },
      { key: 'fumbleLost', label: 'Fumble lost', step: 1 },
      { key: 'returnTd', label: 'Kick or punt return TD', step: 1 },
    ],
  },
  {
    title: 'Kicker',
    fields: [
      { key: 'fg0to39', label: 'Field goal 0-39 yards', step: 1 },
      { key: 'fg40to49', label: 'Field goal 40-49 yards', step: 1 },
      { key: 'fg50plus', label: 'Field goal 50+ yards', step: 1 },
      { key: 'fgMissed', label: 'Missed field goal', step: 1 },
      { key: 'xpMade', label: 'Extra point', step: 1 },
      { key: 'xpMissed', label: 'Missed extra point', step: 1 },
    ],
  },
  {
    title: 'IDP',
    fields: [
      { key: 'soloTackle', label: 'Solo tackle', step: 0.5 },
      { key: 'assistedTackle', label: 'Assisted tackle', step: 0.5 },
      { key: 'sack', label: 'Sack', step: 0.5 },
      { key: 'tackleForLoss', label: 'Tackle for loss', step: 0.5 },
      { key: 'qbHit', label: 'QB hit', step: 0.5 },
      { key: 'passDefended', label: 'Pass defended', step: 0.5 },
      { key: 'idpInterception', label: 'Interception', step: 1 },
      { key: 'fumbleRecovery', label: 'Fumble recovery', step: 1 },
      { key: 'defensiveTd', label: 'Defensive TD', step: 1 },
      { key: 'safety', label: 'Safety', step: 1 },
    ],
  },
  {
    title: 'Team defense',
    fields: [
      { key: 'dstSack', label: 'Sack', step: 0.5 },
      { key: 'dstInterception', label: 'Interception', step: 1 },
      { key: 'dstFumbleRecovery', label: 'Fumble recovery', step: 1 },
      { key: 'dstSafety', label: 'Safety', step: 1 },
      { key: 'dstTd', label: 'Defense or return TD', step: 1 },
    ],
  },
];
```

- [ ] **Step 2: Write the failing test `src/ui/SettingsPage.test.tsx`**

```tsx
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import summary from '../test/fixtures/summary-pit-cle.json';
import { profilesFixture, scoreboardFixture, warren } from '../test/data';
import { mockFetch } from '../test/mockFetch';
import { renderAt, seed } from '../test/render';

const profiles = () => JSON.parse(localStorage.getItem('nflsw:v1:profiles') ?? '[]');
const fieldset = (name: string) => screen.getByRole('group', { name });

describe('settings page', () => {
  it('shows the default profile and saves an edited value as custom', async () => {
    renderAt('/settings');
    expect(screen.getByRole('button', { name: 'My league' })).toHaveAttribute('aria-current', 'true');
    const passTd = within(fieldset('Offense')).getByLabelText('Passing TD');
    await userEvent.clear(passTd);
    await userEvent.type(passTd, '6');
    expect(profiles()[0].values.passTd).toBe(6);
    expect(profiles()[0].preset).toBe('custom');
    expect(screen.getByLabelText('Preset')).toHaveValue('custom');
  });

  it('edits points-allowed tiers', async () => {
    renderAt('/settings');
    const tier = within(fieldset('Team defense')).getByLabelText('0 points allowed');
    await userEvent.clear(tier);
    await userEvent.type(tier, '12');
    expect(profiles()[0].values.pointsAllowed[0]).toBe(12);
  });

  it('adds and renames a profile', async () => {
    renderAt('/settings');
    await userEvent.click(screen.getByRole('button', { name: 'Add profile' }));
    const name = screen.getByLabelText('Name');
    expect(name).toHaveValue('New league');
    await userEvent.clear(name);
    await userEvent.type(name, 'Dynasty');
    expect(screen.getByRole('button', { name: 'Dynasty' })).toHaveAttribute('aria-current', 'true');
    expect(profiles().map((p: { name: string }) => p.name)).toEqual(['My league', 'Dynasty']);
  });

  it('applies a preset only after confirmation', async () => {
    seed([], profilesFixture);
    renderAt('/settings');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    await userEvent.selectOptions(screen.getByLabelText('Preset'), 'standard');
    expect(profiles()[0].values.reception).toBe(1);
    expect(screen.getByLabelText('Preset')).toHaveValue('ppr');
    await userEvent.selectOptions(screen.getByLabelText('Preset'), 'standard');
    expect(profiles()[0].values.reception).toBe(0);
    expect(profiles()[0].preset).toBe('standard');
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it('does not allow deleting the last profile', () => {
    renderAt('/settings');
    expect(screen.getByRole('button', { name: 'Delete profile' })).toBeDisabled();
  });

  it('moves followed cards when deleting a profile', async () => {
    seed([warren], profilesFixture);
    renderAt('/settings');
    await userEvent.click(screen.getByRole('button', { name: 'Delete profile' }));
    expect(screen.getByLabelText('Move 1 followed card to')).toHaveValue('p2');
    await userEvent.click(screen.getByRole('button', { name: 'Delete Office league' }));
    expect(profiles().map((p: { id: string }) => p.id)).toEqual(['p2']);
    expect(JSON.parse(localStorage.getItem('nflsw:v1:followed')!)[0].profileId).toBe('p2');
    expect(screen.getByRole('button', { name: 'Friends league' })).toHaveAttribute('aria-current', 'true');
  });

  it('changes card points on the main screen', async () => {
    seed([warren], profilesFixture);
    mockFetch({ scoreboard: scoreboardFixture, 'summary?event=401872964': summary });
    const { unmount } = renderAt('/settings');
    const reception = within(fieldset('Offense')).getByLabelText('Reception');
    await userEvent.clear(reception);
    await userEvent.type(reception, '0');
    unmount();
    renderAt('/');
    expect(await screen.findByText('12.60')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run it and see it fail**

Run: `npx vitest run src/ui/SettingsPage.test.tsx`
Expected: FAIL, no "My league" button.

- [ ] **Step 4: Replace `src/ui/SettingsPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { FIELD_GROUPS } from '../scoring/fields';
import { PRESET_LABELS } from '../scoring/presets';
import { POINTS_ALLOWED_TIERS, type PresetId, type Profile } from '../scoring/types';
import { followedStore } from '../storage/followed';
import { addProfile, applyPreset, deleteProfile, profilesStore, renameProfile, setTier, setValue } from '../storage/profiles';
import { useStore } from '../storage/useStore';
import { Header } from './Header';

function NumberField({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  // Follow outside changes (presets) without fighting partial input such as "0." or "".
  useEffect(() => {
    if (Number.parseFloat(text) !== value) setText(String(value));
  }, [value]);
  return (
    <label className="num-field">
      {label}
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number.parseFloat(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </label>
  );
}

function ProfileForm({ profile, profiles, usedBy, onDeleted }: { profile: Profile; profiles: Profile[]; usedBy: number; onDeleted: (moveTo: string) => void }) {
  const others = profiles.filter((p) => p.id !== profile.id);
  const [deleting, setDeleting] = useState(false);
  const [moveTo, setMoveTo] = useState(others[0]?.id ?? '');

  function choosePreset(preset: PresetId) {
    if (window.confirm(`Replace all values in ${profile.name} with the ${PRESET_LABELS[preset]} preset?`)) applyPreset(profile.id, preset);
  }

  return (
    <section className="profile-form" aria-label={`Edit ${profile.name}`}>
      <label className="field-label">
        Name
        <input
          value={profile.name}
          onChange={(e) => renameProfile(profile.id, e.target.value)}
          onBlur={(e) => {
            if (!e.target.value.trim()) renameProfile(profile.id, 'Untitled league');
          }}
        />
      </label>
      <label className="field-label">
        Preset
        <select value={profile.preset} onChange={(e) => choosePreset(e.target.value as PresetId)}>
          {(Object.keys(PRESET_LABELS) as PresetId[]).map((id) => <option key={id} value={id}>{PRESET_LABELS[id]}</option>)}
          <option value="custom" disabled>Custom</option>
        </select>
      </label>

      {FIELD_GROUPS.map((group) => (
        <fieldset key={group.title}>
          <legend>{group.title}</legend>
          {group.fields.map((f) => (
            <NumberField key={f.key} label={f.label} step={f.step} value={profile.values[f.key]} onChange={(n) => setValue(profile.id, f.key, n)} />
          ))}
          {group.title === 'Team defense' &&
            POINTS_ALLOWED_TIERS.map((tier, i) => (
              <NumberField key={tier} label={`${tier} points allowed`} step={1} value={profile.values.pointsAllowed[i] ?? 0} onChange={(n) => setTier(profile.id, i, n)} />
            ))}
        </fieldset>
      ))}

      {!deleting && (
        <div>
          <button type="button" className="btn btn-danger" disabled={others.length === 0} onClick={() => setDeleting(true)}>
            Delete profile
          </button>
          {others.length === 0 && <p className="muted">You need at least one profile.</p>}
        </div>
      )}
      {deleting && (
        <div className="confirm" role="group" aria-label="Confirm delete">
          {usedBy > 0 ? (
            <label className="field-label">
              {`Move ${usedBy} followed ${usedBy === 1 ? 'card' : 'cards'} to`}
              <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                {others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          ) : (
            <p>Delete {profile.name}? No followed cards use it.</p>
          )}
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              if (deleteProfile(profile.id, moveTo)) onDeleted(moveTo);
            }}
          >
            Delete {profile.name}
          </button>
          <button type="button" className="btn" onClick={() => setDeleting(false)}>Cancel</button>
        </div>
      )}
    </section>
  );
}

export function SettingsPage() {
  const profiles = useStore(profilesStore);
  const followed = useStore(followedStore);
  const [selectedId, setSelectedId] = useState(profiles[0]!.id);
  const profile = profiles.find((p) => p.id === selectedId) ?? profiles[0]!;

  return (
    <>
      <Header />
      <main className="wrap">
        <h2 className="section-title">Scoring profiles</h2>
        <div className="settings-grid">
          <nav aria-label="Profiles">
            <ul className="profile-list">
              {profiles.map((p) => (
                <li key={p.id}>
                  <button type="button" aria-current={p.id === profile.id ? 'true' : undefined} onClick={() => setSelectedId(p.id)}>
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="btn press" onClick={() => setSelectedId(addProfile('New league'))}>
              Add profile
            </button>
          </nav>
          <ProfileForm
            key={profile.id}
            profile={profile}
            profiles={profiles}
            usedBy={followed.filter((f) => f.profileId === profile.id).length}
            onDeleted={setSelectedId}
          />
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 5: Run the tests and see them pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/scoring/fields.ts src/ui
git commit -m "feat: add settings page for scoring profiles"
```

---

### Task 11: Docker image and Kubernetes manifest

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `nginx.conf`, `k8s/deployment.yaml`

**Interfaces:**
- Consumes: `npm run build` output in `dist/`.
- Produces: an image listening on port 8080; Deployment and Service named `stat-watch`.

- [ ] **Step 1: Write `nginx.conf`**

```nginx
server {
  listen 8080;
  server_name _;
  root /usr/share/nginx/html;

  # Vite emits content-hashed files here; they never change.
  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
  }

  # Client-side routes such as /settings fall back to the app.
  location / {
    add_header Cache-Control "no-cache";
    try_files $uri $uri/ /index.html;
  }
}
```

- [ ] **Step 2: Write `Dockerfile` and `.dockerignore`**

`Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
USER 101
```

`.dockerignore`:

```
node_modules
dist
coverage
.git
docs
prototypes
k8s
.impeccable
```

- [ ] **Step 3: Build and run the image read-only, the way Kubernetes will**

```bash
docker build -t stat-watch:dev .
docker run -d --name stat-watch-test -p 8080:8080 --read-only --tmpfs /tmp stat-watch:dev
sleep 2
curl -s -o /dev/null -w "root %{http_code}\n" http://localhost:8080/
curl -s -o /dev/null -w "settings %{http_code}\n" http://localhost:8080/settings
curl -sI http://localhost:8080/settings | grep -i cache-control
ASSET=$(curl -s http://localhost:8080/ | grep -o '/assets/[^"]*\.js' | head -1)
curl -sI "http://localhost:8080$ASSET" | grep -i cache-control
docker rm -f stat-watch-test
```

Expected: `root 200`, `settings 200`, `Cache-Control: no-cache` for `/settings`, and `public, max-age=31536000, immutable` for the asset. If the container exits, read `docker logs stat-watch-test` before changing anything.

- [ ] **Step 4: Write `k8s/deployment.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: stat-watch
  labels:
    app: stat-watch
spec:
  replicas: 1
  selector:
    matchLabels:
      app: stat-watch
  template:
    metadata:
      labels:
        app: stat-watch
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 101
        runAsGroup: 101
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: web
          # Set this to the image you pushed to your registry.
          image: registry.example.com/stat-watch:0.1.0
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /
              port: http
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /
              port: http
            initialDelaySeconds: 5
            periodSeconds: 20
          resources:
            requests:
              cpu: 10m
              memory: 32Mi
            limits:
              cpu: 200m
              memory: 64Mi
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
          volumeMounts:
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: tmp
          emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: stat-watch
  labels:
    app: stat-watch
spec:
  type: ClusterIP
  selector:
    app: stat-watch
  ports:
    - name: http
      port: 80
      targetPort: http
```

- [ ] **Step 5: Validate the manifest**

Run: `docker run --rm -v "$PWD/k8s:/k8s" ghcr.io/yannh/kubeconform:latest -strict -summary /k8s/deployment.yaml`
Expected: `Summary: 2 resources found in 1 file - Valid: 2, Invalid: 0, Errors: 0, Skipped: 0`. If `kubectl` is configured, `kubectl apply --dry-run=client -f k8s/deployment.yaml` must also succeed.

- [ ] **Step 6: Commit**

```bash
git add Dockerfile .dockerignore nginx.conf k8s
git commit -m "build: add Docker image and Kubernetes deployment"
```

---

### Task 12: End-to-end verification, accessibility, docs and cleanup

**Files:**
- Create: `README.md`, `docs/components.md`
- Delete: `prototypes/main-screen.html`
- Modify: `.impeccable/config.json` (remove the `side-tab` ignore scoped to the prototype)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Full suite and build**

Run: `npm test && npm run build`
Expected: every test passes, build succeeds. Record the test count for the hand-off report.

- [ ] **Step 2: Drive the real app in a browser**

Rebuild and run the image (`docker build -t stat-watch:dev . && docker run -d --name stat-watch-e2e -p 8080:8080 --read-only --tmpfs /tmp stat-watch:dev`) and use the `webapp-testing` skill against `http://localhost:8080`. Check each item and keep a screenshot of each:

1. Empty state on first load; "My league" exists in Settings.
2. Add a QB, a RB, a WR or TE, a kicker, an IDP player and a team defense through the dialog; each card appears in the right group.
3. Add the same player to a second profile: two cards with different league chips and, where scoring differs, different points.
4. Reload: all cards and profiles are still there.
5. Points breakdown opens and closes; Remove works; the league picker moves a card.
6. Settings: change a value, switch presets with confirmation, rename, add and delete a profile with cards moved. Main screen points follow.
7. Light and dark theme, toggled and after reload, with no flash of the other theme.
8. 390px wide: no horizontal scroll, everything reachable.
9. If a game is live during the check (NFL windows in Amsterdam time: Sunday 19:00, 22:05, 22:25 and 02:20; Monday and Friday about 02:15): the mini field shows, the ball moves between plays, numbers update within about 10 seconds and highlight, and the red-zone outline appears when the offense crosses the 20. If no game is live, say so in the report instead of claiming this item.
10. With the network set to offline in DevTools, cards keep their numbers and show the retry note.

Fix any failure in the owning task's files, add a regression test for it, and re-run Step 1. Stop the container afterwards: `docker rm -f stat-watch-e2e`.

- [ ] **Step 3: Accessibility review**

Review the running app with the `web-design-guidelines` skill, then dispatch the `ecc:a11y-architect` agent for an independent WCAG 2.2 AA pass on `src/ui` and `src/styles.css`. Fix every AA failure. Check in particular: contrast of `--muted` text and the league chip in both themes, focus order and focus return in the dialog, the mini field `aria-label`, and that `aria-live` on search results does not announce on every keystroke.

- [ ] **Step 4: Write `README.md`**

```markdown
# Stat Watch

Follow NFL players and team defenses from all your fantasy leagues in one place, with live stats and fantasy points per league.

## Run locally

    npm install
    npm run dev        # http://localhost:5173
    npm test           # unit and component tests
    npm run build      # type check and production build

## Data

Stats come from ESPN's public, unofficial JSON API, called directly from the browser. It needs no key and may change without notice. Live games refresh every 10 seconds, the week's schedule every minute while games are live.

Everything you follow and every scoring profile is stored in your browser's localStorage. There is no account and no server-side storage.

Known limits: forced fumbles are not scored (ESPN's box score has no forced fumbles), and team defense points allowed is the opponent's full score.

## Container

    docker build -t stat-watch:0.1.0 .
    docker run -p 8080:8080 --read-only --tmpfs /tmp stat-watch:0.1.0

## Kubernetes

Push the image to your registry, set the `image` field in `k8s/deployment.yaml`, then:

    kubectl apply -f k8s/deployment.yaml

This creates a Deployment and a ClusterIP Service named `stat-watch` on port 80. Add an Ingress or route for your own hostname.

## Tests and fixtures

`npm run capture-fixtures` downloads the ESPN responses in `src/test/fixtures` again. Test expectations are pinned to the Steelers at Browns game of week 4, 2026.
```

- [ ] **Step 5: Write `docs/components.md`**

```markdown
# UI components

## Header
Props: `actions?: ReactNode` (extra buttons, for example "Add player").
Shows the app name, Players and Settings links (current page marked with `aria-current`), and the theme toggle.

## ThemeToggle
No props. Shows "Dark mode" in the light theme and "Light mode" in the dark theme. Stores the choice in `nflsw:v1:theme`.

## MainPage
No props. States: empty (nothing followed), grouped (Live now, Final, Later, Bye week), schedule unavailable (one "Followed" group, cards say "Game status unavailable"), scoreboard error with older data (note under the header).

## EntryCard
Props: `entry: FollowedEntry`, `game: GameInfo | null`, `profiles: Profile[]`, `hasSchedule: boolean`.
States: live (wide, mini field, situation and last play), live in the red zone (orange outline and "Red zone" label, only for offensive players of the team with the ball), final (result line), scheduled (kickoff time, "No stats until kickoff"), bye, no stats, breakdown open, retry note.

## MiniField
Props: `game: GameInfo`, `situation: Situation`.
The offense always attacks to the right. Endzones use team colors with contrast-checked text. The ball glides within a possession and jumps on a change of possession.

## Bump
Props: `value: string`. Highlights the value for 900ms when it changes. No animation under reduced motion.

## AddDialog
Props: `open: boolean`, `onClose: () => void`.
States: hint (fewer than 2 letters), loading team for a result, results (team defenses first, then players), added, free agent (cannot be added), no matches, search unavailable.

## SettingsPage
No props. Profile list plus the selected profile's form: name, preset (with confirmation), value groups Offense, Kicker, IDP and Team defense (with points-allowed tiers). Delete is disabled for the last profile and asks where to move followed cards.
```

- [ ] **Step 6: Remove the prototype and its design-checker exception**

```bash
git rm prototypes/main-screen.html
```

Edit `.impeccable/config.json` and remove the `side-tab` entry scoped to `prototypes/main-screen.html`. Keep the file valid JSON; delete it if nothing else remains in it.

- [ ] **Step 7: Final run, commit and push**

```bash
npm test && npm run build
git add -A
git commit -m "docs: add README and component docs, remove design prototype"
git remote -v
```

If `git remote -v` lists a remote, run `git push -u origin feat/stat-watch-poc`. If it lists nothing, do not create one; report that the branch is ready locally and that no remote is configured.
