# Deployment

Two GitHub Actions workflows deploy the app to Kubernetes:

| Push to | Workflow | Namespace | GitHub environment |
| --- | --- | --- | --- |
| `main` (including a merge) | `.github/workflows/deploy-live.yml` | `nfl-stat-watcher` | `live` |
| any other branch | `.github/workflows/deploy-test.yml` | `nfl-stat-watcher-test` | `test` |

Both call `.github/workflows/_deploy.yml`, which does the same four things for either target: type check and run the tests,
build the image and push it to `ghcr.io/<owner>/<repo>:<commit>`, connect to the cluster as that namespace's service
account, apply `k8s/app.yaml` (Deployment, Service, Ingress) and wait for the rollout. A failed check stops everything
before an image is built.

The test namespace is one slot: a newer push to any branch replaces a deployment still running. Live deployments queue
one at a time and are never cancelled half way.

## One-time cluster setup (a cluster admin)

```sh
kubectl apply -f k8s/rbac.yaml
```

This creates both namespaces (with the `restricted` pod security level the app already meets) and, in each, a
`github-deployer` service account with a token Secret. Its Role covers only this app's Deployment, Service and Ingress
(create, update, patch, read), plus read access to ReplicaSets, Pods and Events so a failed rollout can be explained. It
is a namespace-scoped Role, never a ClusterRole, so the account has no access to any other namespace, to cluster-wide
resources, or to Secrets, and it cannot delete anything or change RBAC. Neither account can use the other's namespace.
The pipeline never applies `k8s/rbac.yaml`.

## One-time GitHub setup

Create two environments, **test** and **live** (Settings, Environments). For **live**, consider requiring a reviewer.
In each, set these, taking the values from the matching namespace (replace `NS` with `nfl-stat-watcher` for live and
`nfl-stat-watcher-test` for test):

| Name | Kind | Value |
| --- | --- | --- |
| `KUBE_SERVER` | secret | `kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}'` (must be reachable from GitHub's runners) |
| `KUBE_CA` | secret | `kubectl -n NS get secret github-deployer-token -o jsonpath='{.data.ca\.crt}'` (keep it base64 as printed) |
| `KUBE_TOKEN` | secret | `kubectl -n NS get secret github-deployer-token -o jsonpath='{.data.token}' \| base64 -d` |
| `HOST` | variable | the hostname for the Ingress, for example `stat-watch.example.com` |
| `INGRESS_CLASS` | variable | your ingress class, for example `nginx` |

The workflow stops early with a message naming anything missing.

## Pulling the image

If the GHCR package is public nothing more is needed. If it is private, create a pull secret once per namespace (the
pipeline's account cannot read or create Secrets):

```sh
kubectl -n NS create secret docker-registry ghcr-pull \
  --docker-server=ghcr.io --docker-username=<github user> --docker-password=<token with read:packages>
```

`k8s/app.yaml` already references `ghcr-pull`; a missing secret is only a warning when the image is public.

## Not covered

- **TLS:** the Ingress has no TLS section. Add `tls` and your issuer annotation to `k8s/app.yaml` if the cluster expects them.
- **Token rotation:** the service account tokens do not expire. To rotate, delete the token Secret and apply `k8s/rbac.yaml`
  again, then update the GitHub secrets.
- **Action versions:** the actions are pinned to major versions (`@v4`, `@v3`, `@v6`), not commit SHAs.
