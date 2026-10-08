import { EVENTS, VITAL_BUCKETS, type EventName, type VitalName } from '../src/metrics/events.ts';

const ACTIVE_MS = 90_000; // a tab beats every 60 s, so one missed beat is forgiven
const MAX_SESSIONS = 10_000; // ponytail: caps memory if someone floods fake ids; real traffic is nowhere near it
const SESSION_ID = /^[a-z0-9-]{8,40}$/;
const WITH_USER_AGENT = new Set<string>(['visit']);

type Series = Record<string, string>;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Browser, system and kind of device from a User-Agent, each one of a few fixed words so it is safe as a label. The header itself is never kept. */
export function classify(userAgent: string): { browser: string; os: string; device: string } {
  const ua = userAgent;
  const os = /iPhone|iPad|iPod/.test(ua) ? 'ios' : /Android/.test(ua) ? 'android' : /Windows/.test(ua) ? 'windows' : /Macintosh|Mac OS X/.test(ua) ? 'macos' : /Linux|X11|CrOS/.test(ua) ? 'linux' : 'other';
  const browser = /Edg\//.test(ua) ? 'edge' : /OPR\/|Opera/.test(ua) ? 'other' : /Firefox\/|FxiOS/.test(ua) ? 'firefox' : /Chrome\/|CriOS/.test(ua) ? 'chrome' : /Safari\//.test(ua) ? 'safari' : 'other';
  const device = !ua || /bot|crawl|spider|headless|lighthouse|curl|wget/i.test(ua) ? 'bot' : /iPad|Tablet|Android(?!.*Mobile)/.test(ua) ? 'tablet' : /iPhone|iPod|Mobi/.test(ua) ? 'mobile' : 'desktop';
  return { browser, os, device };
}

const series = (name: string, labels: Series) => {
  const body = Object.keys(labels).sort().map((key) => `${key}="${labels[key]}"`).join(','); // values come from fixed lists, so they need no escaping
  return body ? `${name}{${body}}` : name;
};

type Histogram = { counts: number[]; sum: number }; // counts has one slot per bucket and a last one for everything above them

/** Everything the collector knows, in memory: a restart resets the counters, which Prometheus's rate() and increase() already handle. */
export class Collector {
  private counters = new Map<string, number>();
  private vitals = new Map<VitalName, Histogram>();
  private sessions = new Map<string, number>(); // random tab id -> when it last beat; the ids are never exported
  private rejected = 0;

  constructor() {
    // Series with no labels exist from the start, so a dashboard shows 0 instead of "no data".
    for (const [name, spec] of Object.entries(EVENTS)) if (!WITH_USER_AGENT.has(name) && Object.keys(spec).length === 0) this.counters.set(`statwatch_${name}_total`, 0);
    for (const name of Object.keys(VITAL_BUCKETS) as VitalName[]) this.vitals.set(name, { counts: new Array(VITAL_BUCKETS[name].length + 1).fill(0), sum: 0 });
  }

  /** Counts one event if it is on the list in src/metrics/events.ts, with exactly its labels and only allowed values. Returns false for anything else. */
  accept(body: unknown, userAgent = '', now = Date.now()): boolean {
    if (!isRecord(body) || typeof body.e !== 'string') return this.reject();
    if (body.e === 'beat') return this.beat(body.id, now);
    if (body.e === 'vital') return this.vital(body.l, body.v);
    if (!Object.hasOwn(EVENTS, body.e)) return this.reject();
    const spec: Record<string, readonly string[]> = EVENTS[body.e as EventName];
    const labels = isRecord(body.l) ? body.l : {};
    const keys = Object.keys(spec);
    if (Object.keys(labels).length !== keys.length || !keys.every((key) => typeof labels[key] === 'string' && spec[key]!.includes(labels[key] as string))) return this.reject();
    const key = series(`statwatch_${body.e}_total`, { ...(labels as Series), ...(WITH_USER_AGENT.has(body.e) ? classify(userAgent) : {}) });
    this.counters.set(key, (this.counters.get(key) ?? 0) + 1);
    return true;
  }

  private reject() {
    this.rejected += 1;
    return false;
  }

  private beat(id: unknown, now: number) {
    if (typeof id !== 'string' || !SESSION_ID.test(id)) return this.reject();
    if (this.sessions.size >= MAX_SESSIONS && !this.sessions.has(id)) this.active(now);
    if (this.sessions.size >= MAX_SESSIONS && !this.sessions.has(id)) return this.reject();
    this.sessions.set(id, now);
    return true;
  }

  private vital(labels: unknown, value: unknown) {
    const name = isRecord(labels) ? labels.name : undefined;
    if (typeof name !== 'string' || !Object.hasOwn(VITAL_BUCKETS, name) || typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e7) return this.reject();
    const histogram = this.vitals.get(name as VitalName)!;
    const buckets: readonly number[] = VITAL_BUCKETS[name as VitalName];
    const at = buckets.findIndex((upper) => value <= upper);
    histogram.counts[at === -1 ? buckets.length : at]! += 1;
    histogram.sum += value;
    return true;
  }

  /** Tabs that beat within the last 90 seconds. Older ones are forgotten here. */
  active(now = Date.now()): number {
    for (const [id, seen] of this.sessions) if (now - seen > ACTIVE_MS) this.sessions.delete(id);
    return this.sessions.size;
  }

  /** The Prometheus text format (version 0.0.4). */
  render(now = Date.now()): string {
    const lines: string[] = [];
    let last = '';
    for (const [key, count] of [...this.counters].sort(([a], [b]) => a.localeCompare(b))) {
      const name = key.split('{')[0]!;
      if (name !== last) lines.push(`# TYPE ${name} counter`);
      last = name;
      lines.push(`${key} ${count}`);
    }
    lines.push('# TYPE statwatch_web_vital histogram');
    for (const [name, { counts, sum }] of this.vitals) {
      let cumulative = 0;
      VITAL_BUCKETS[name].forEach((upper, i) => {
        cumulative += counts[i]!;
        lines.push(`statwatch_web_vital_bucket{name="${name}",le="${upper}"} ${cumulative}`);
      });
      const total = cumulative + counts[counts.length - 1]!;
      lines.push(`statwatch_web_vital_bucket{name="${name}",le="+Inf"} ${total}`, `statwatch_web_vital_sum{name="${name}"} ${sum}`, `statwatch_web_vital_count{name="${name}"} ${total}`);
    }
    lines.push('# TYPE statwatch_active_sessions gauge', `statwatch_active_sessions ${this.active(now)}`);
    lines.push('# TYPE statwatch_events_rejected_total counter', `statwatch_events_rejected_total ${this.rejected}`);
    return `${lines.join('\n')}\n`;
  }
}
