/**
 * Every usage event the app may report, the labels each one carries and the values each label may take. The app sends from this list
 * and the collector (collector/) accepts only from it, so a typo or a hostile client can never create a new Prometheus time series.
 * Plain TypeScript with no DOM or React: Node runs this file as it is.
 *
 * `visit` also gets browser, os and device, which the collector reads from the User-Agent header.
 */
export const EVENTS = {
  /** A page load. */
  visit: {},
  /** A screen opened, on load or by navigating. */
  page_view: { route: ['players', 'vs', 'leagues', 'settings', 'privacy'] },
  /** An ESPN league's settings were looked up: it loaded, it is private, or it failed. */
  league_load: { result: ['ok', 'private', 'error'] },
  /** A league was saved as a profile. `transport` tells public (public-api) from private (browser-session, settings-file). */
  league_import: { transport: ['public-api', 'browser-session', 'settings-file'], mode: ['new', 'refresh'], issues: ['none', 'some'] },
  /** A league's rosters were looked up to sync starters. */
  sync_load: { result: ['ok', 'private', 'error'] },
  /** Starters were synced. */
  sync: { side: ['mine', 'opponent', 'both'], leagues: ['one', 'many'] },
  /** A step of the private league setup help was used. */
  help: { step: ['how_settings', 'how_bookmark', 'how_rosters', 'video', 'copy_bookmark'] },
  /** An ESPN request failed; at most one per kind per minute per tab. */
  fetch_error: { kind: ['4xx', '5xx', 'network'] },
  /** A script error or unhandled promise rejection; at most five per page load. */
  js_error: {},
} as const satisfies Record<string, Record<string, readonly string[]>>;

export type EventName = keyof typeof EVENTS;
export type Labels<E extends EventName> = { [K in keyof (typeof EVENTS)[E]]: (typeof EVENTS)[E][K] extends readonly (infer V)[] ? V : never };

/** Core Web Vitals, each with its histogram buckets: the "good" and "poor" thresholds of web.dev sit on bucket edges. */
export const VITAL_BUCKETS = {
  LCP: [1000, 2500, 4000, 8000], // ms
  INP: [100, 200, 500, 1000], // ms
  CLS: [0.05, 0.1, 0.25, 0.5], // unitless
} as const;
export type VitalName = keyof typeof VITAL_BUCKETS;

/** What travels in the POST body of /api/e. A heartbeat carries only the tab's random id, kept in memory and never stored. */
export type Wire =
  | { e: EventName; l?: Record<string, string> }
  | { e: 'vital'; l: { name: VitalName }; v: number }
  | { e: 'beat'; id: string };
