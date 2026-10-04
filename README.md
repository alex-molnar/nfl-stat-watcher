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
