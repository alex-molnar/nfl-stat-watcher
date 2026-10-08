# ADR 0002: Count usage with a small collector beside nginx

**Status:** Accepted  
**Date:** 2026-10-08

## Context

The site is a static app served by nginx, with no backend. Everything interesting (importing a league, syncing starters, how long a tab stays live) happens in the browser, so nginx's own metrics (`stub_status`, access logs) show traffic but not usage. The goal is a Grafana dashboard, on the cluster's existing Prometheus, of visits (with browser, system and device), imports (public or private), syncing, live tabs and page health. The site's promise is that nothing leaves the browser, and its owner is in the EU, so the counting has to stay anonymous.

## Decision

The app reports named events to `POST /api/e`. nginx forwards them to a collector container in the same pod: about 150 lines of dependency-free Node (`collector/`), in its own image from the same Dockerfile. It counts events in memory, validates each one against the allowlist in `src/metrics/events.ts` (shared with the app), and serves Prometheus's text format on `/metrics`. A `ServiceMonitor` makes Prometheus scrape it.

- **One list of events and label values** is the only way a series can exist. The same file types the app's calls, so a typo is a compile error and a hostile client cannot create series.
- **Hand-written exposition format** instead of `prom-client`: counters, one histogram and one gauge are a few dozen lines, so the image has no `node_modules`, nothing to patch, nothing to build.
- **Active tabs** come from a heartbeat with a random in-memory id, kept by the collector for 90 s and never exported. No cookie, no storage on the device, no persistent identifier.
- **The User-Agent** is reduced to a few words (browser, system, device) inside the collector and thrown away. The beacon requests are kept out of nginx's access log, and the collector never sees an IP address.
- **Off** in development and tests, and for Do Not Track and Global Privacy Control.
- **`web-vitals`** is the one new runtime dependency: measuring INP and CLS correctly (bfcache, hidden tabs, late shifts) is not worth redoing.
- **The collector image is another tag of the existing GHCR package** (`<sha>-collector`), so no new package, visibility or pull secret to set up.

## Alternatives considered

- **`stub_status` plus the nginx exporter only.** Cheap, but blind to everything the user does in the app.
- **Parse the access log (mtail, Loki).** Needs the events in URLs, puts visitor IPs next to them, and cannot give active tabs.
- **Umami or Plausible.** Better visit analytics out of the box, but a database to run, and Grafana would read Postgres instead of the Prometheus that is already there.
- **`prom-client` in the collector.** The standard library, but a dependency tree for a few dozen lines.
- **Browser OpenTelemetry.** Heavy for this size.

## Consequences

- The deployer's Role needs `servicemonitors` in `monitoring.coreos.com`, so `k8s/rbac.yaml` must be applied again by an admin before the first deployment of this change (see `docs/deployment.md`).
- Counters live in the collector's memory: a restart resets them (Prometheus copes) and the deployment stays at one replica.
- The endpoint is public and unauthenticated, so counts can be inflated by anyone, though never by more than the allowlist allows. Accepted for a hobby app; a rate limit at the ingress is the upgrade.
- A visit is a page load, not a person. There is no way to count unique visitors, on purpose.
- The Privacy page now has to stay true to `events.ts`; adding an event means updating both (`docs/metrics/metrics.md`, "Adding an event").
- Google Fonts is loaded from Google's servers and the Privacy page says so; self-hosting the fonts would remove that disclosure.
