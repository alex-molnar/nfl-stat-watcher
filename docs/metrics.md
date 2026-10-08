# Usage metrics

The site counts how it is used, anonymously, so a Grafana dashboard can show visits, imports, syncing and health. This page is how it works, what is counted, and the queries to start a dashboard from. The promise made to visitors is on the Privacy page (`src/ui/PrivacyPage.tsx`); keep the two in step.

```
browser ──POST /api/e──▶ nginx ──▶ collector (same pod, :9100) ◀──scrape── Prometheus ──▶ Grafana
  track()                  └─ not logged        keeps counters in memory      ServiceMonitor
```

- **The app** calls `track(event, labels)` (`src/metrics/track.ts`) where something happens. It uses `navigator.sendBeacon`, never waits and never throws. It does nothing in development and tests, and for a browser that sends Do Not Track or Global Privacy Control.
- **nginx** forwards `POST /api/e` to the collector on `127.0.0.1:9100` and leaves it out of the access log. Bodies over 2 KB and other methods are refused.
- **The collector** (`collector/`, plain Node with no dependencies, its own image) checks every event against the list in `src/metrics/events.ts` and counts it. Anything not on the list, or with a label value not on the list, is refused and counted in `statwatch_events_rejected_total`. That list is also what bounds the number of time series.
- **Prometheus** scrapes `/metrics` on port 9100 through the Service's `metrics` port, via the `ServiceMonitor` in `k8s/app.yaml`. That port is not on the Ingress.

## What is counted

| Event | Metric | Labels | Fired when |
| --- | --- | --- | --- |
| `visit` | `statwatch_visit_total` | `browser`, `os`, `device` (from the User-Agent, by the collector) | the page loads (a reload counts again) |
| `page_view` | `statwatch_page_view_total` | `route`: players, vs, leagues, settings, privacy | a screen opens, on load or by navigating |
| `league_load` | `statwatch_league_load_total` | `result`: ok, private, error | an ESPN league's settings were looked up |
| `league_import` | `statwatch_league_import_total` | `transport`: public-api (public), browser-session or settings-file (private); `mode`: new, refresh; `issues`: none, some | a league was saved as a profile |
| `sync_load` | `statwatch_sync_load_total` | `result`: ok, private, error | rosters were looked up to sync starters (a pasted roster counts as ok) |
| `sync` | `statwatch_sync_total` | `side`: mine, opponent, both; `leagues`: one, many | starters were synced |
| `help` | `statwatch_help_total` | `step`: how_settings, how_bookmark, how_rosters, copy_bookmark, video | a step of the private league help was used |
| `fetch_error` | `statwatch_fetch_error_total` | `kind`: 4xx, 5xx, network | an ESPN request failed; at most once a minute per kind per tab |
| `js_error` | `statwatch_js_error_total` | none | a script error or unhandled rejection; at most five per page load |
| `vital` | `statwatch_web_vital` (histogram) | `name`: LCP, INP, CLS | the browser reports the measurement, usually when the page is hidden |
| `beat` | `statwatch_active_sessions` (gauge) | none | every 60 s from a visible tab that is not paused and follows something |

Device is `bot` for crawlers and requests with no User-Agent, so filter with `device!="bot"` for people. Never in any label: league ids or names, team or player names, IP addresses, the User-Agent text. The `beat` id is a random per-tab UUID in memory; the collector keeps it for 90 s to count tabs and never exports it.

## Starting queries for Grafana

Use `$__range` (the dashboard's time range) for totals. All counters are `increase()`d, which copes with the collector restarting.

| Panel | Query |
| --- | --- |
| Visits per day (people) | `sum(increase(statwatch_visit_total{device!="bot"}[1d]))` |
| Visits by browser / OS / device | `sum by (browser) (increase(statwatch_visit_total{device!="bot"}[$__range]))` (swap `browser` for `os` or `device`) |
| Screens opened | `sum by (route) (increase(statwatch_page_view_total[$__range]))` |
| Active now (live syncing, tab open) | `statwatch_active_sessions` |
| Busiest moment | `max_over_time(statwatch_active_sessions[$__range])` |
| Leagues imported, public vs private | `sum by (transport) (increase(statwatch_league_import_total[$__range]))` |
| Public vs private as two numbers | `sum(increase(statwatch_league_import_total{transport="public-api"}[$__range]))` and the same with `{transport!="public-api"}` |
| Imports that were refreshes / had approximations | `sum by (mode) (...)`, `sum by (issues) (...)` over the same counter |
| Private leagues that got imported | `sum(increase(statwatch_league_import_total{transport!="public-api"}[$__range])) / sum(increase(statwatch_league_load_total{result="private"}[$__range]))` |
| Sync starters usage | `sum by (side, leagues) (increase(statwatch_sync_total[$__range]))` |
| Private sync setup, by step | `sum by (step) (increase(statwatch_help_total[$__range]))` next to `sum(increase(statwatch_sync_load_total{result="private"}[$__range]))` |
| Core Web Vitals, 75th percentile | `histogram_quantile(0.75, sum by (le, name) (increase(statwatch_web_vital_bucket[$__range])))` |
| Share of "good" LCP | `sum(increase(statwatch_web_vital_bucket{name="LCP",le="2500"}[$__range])) / sum(increase(statwatch_web_vital_count{name="LCP"}[$__range]))` |
| Errors | `sum(increase(statwatch_js_error_total[$__range]))`, `sum by (kind) (increase(statwatch_fetch_error_total[$__range]))` |
| Collector health | `increase(statwatch_events_rejected_total[1h])` should stay near 0. A rise means the app and `events.ts` disagree, or someone is posting junk. |

## Limits

- **Visits are page loads, not people.** There is no visitor id by design, so "unique visitors" cannot be answered. Active sessions is the closest thing to a headcount.
- **Not everyone is counted:** Do Not Track and Global Privacy Control browsers, and ad blockers that block `/api/e`.
- **Anyone can post events.** The endpoint is public, so fake events can inflate counts, though never create new series. No rate limit: nginx sees Traefik's address, not the visitor's, so a per-address limit would throttle everyone together. Add a limit at the ingress if it ever matters.
- **One replica.** Counters and the tab list live in the collector's memory, per pod. With more replicas each pod would count part of the traffic (sum the counters, but active sessions would be split and double counted). Keep `replicas: 1` or move the state out of the pod first.
- **A restart resets the counters and the active list.** Counters are fine (`increase()`); active sessions refills within a minute.
- **Country is not collected.** Traefik sends no country header. See the options below.

## Possible next steps

- **Country:** look the IP up in a GeoIP database in the collector (db-ip lite needs no account) and keep only the country code, or read a country header if a CDN is put in front. Needs a Privacy page line.
- **More detail:** league size, scoring format, or the count of starters synced, as bucketed labels, once there is a question that needs them.
- **Alerts:** Grafana alerts on `statwatch_js_error_total`, `statwatch_fetch_error_total` or a drop in visits.
- **Logs:** Loki for the nginx logs next to the metrics.
- **Opt-out switch:** a setting in Settings besides Do Not Track.

## Adding an event

1. Add it to `EVENTS` in `src/metrics/events.ts`, with every label and every value it may take. The collector accepts nothing else.
2. Call `track('name', { label: 'value' })` where it happens, and add a test next to the others in `src/metrics/tracking.test.tsx`.
3. Add it to the table above, and to `PrivacyPage.tsx` if it says something new about what is collected.

## Running it locally

```sh
PORT=9100 node collector/main.ts      # Node 22.18 or newer runs the TypeScript directly
curl -XPOST localhost:9100/e -d '{"e":"sync","l":{"side":"mine","leagues":"one"}}'
curl localhost:9100/metrics
```

`npm run dev` sends nothing (counting is off outside a production build). `docker build --target collector -t stat-watch-collector .` builds the collector image; the default target is the web image.
