# Stat Watch

Follow NFL players and team defenses from all your fantasy leagues in one place, with live stats and fantasy points per league.

## Run locally

Use Node 22 for local development (the Docker build uses `node:22-alpine`).

    npm install
    npm run dev        # http://localhost:5173
    npm test           # unit and component tests
    npm run build      # type check and production build

## Data

Stats come from ESPN's public, unofficial JSON API, called directly from the browser. It needs no key and may change without notice. Live games refresh every 10 seconds, the week's schedule every minute while games are live.

Everything you follow and every scoring profile is stored in your browser's localStorage. There is no account and no server-side storage.

The site speaks English and Hungarian (Settings → Site settings → Language; Automatic follows the browser). See [the language guide](docs/i18n.md) for how to add a text or a language.

The site counts how it is used, anonymously: page loads and screens, imports and syncs, errors and speed, with no cookies and no ids. A small collector beside nginx turns those into Prometheus metrics. See [the usage metrics guide](docs/metrics/metrics.md) and the Privacy page (`/privacy`).

In Settings, drag anywhere on a position row (with a mouse or touch), or use the arrow buttons under **Position order**, then Save. This preference orders cards within every game-status group on Players and Vs, including Later, Final and Bye week. Live cards still sort by activity first (red zone, on the field, inactive), then by position. The default is QB, RB, WR, TE, K, DL, LB, DB, then team defenses. DE/DT/NT share DL, ILB/OLB/MLB share LB, and CB/safeties share DB; FB uses RB and PK uses K. Reset position order restores the default after Save.

Known limits: forced fumbles are not scored (ESPN's box score has no forced fumbles), and team defense points allowed is the opponent's full score.

## ESPN league scoring import

Leagues can import public ESPN league scoring from a league ID or link and a selected season. Imports show unsupported or approximate rules before saving; source, season and compatibility notes stay with the profile. Private league access uses an optional Chrome companion and remains unverified until the connector has been installed and tested with an authenticated ESPN account. Setup, supported scoring rules and current limits are in [the league import guide](docs/league-import.md).

## Vs mode

Open Vs in the header to see one league as a matchup: your players against your league opponent's players, both scored with that league's scoring profile, and a score bar that says who leads and by how much. Pick the league at the top; each side has its own Add player button. The two sides sit next to each other on wider screens and stack on phones, with the score bar kept in view. Opponent players are stored with your followed players, marked as opponent, and never show on the Players page. Deleting a league in Leagues moves your own cards as before and removes that league's opponent cards.

## Container

    docker build -t stat-watch:0.1.0 .
    docker run -p 8080:8080 --read-only --tmpfs /tmp stat-watch:0.1.0

## Kubernetes

Push the image to your registry, set the `image` field in `k8s/deployment.yaml`, then:

    kubectl apply -f k8s/deployment.yaml

This creates a Deployment and a ClusterIP Service named `stat-watch` on port 80. Add an Ingress or route for your own hostname.

## Tests and fixtures

`npm run capture-fixtures` downloads the ESPN responses in `src/test/fixtures` again. Test expectations are pinned to the Steelers at Browns game of week 4, 2026.
