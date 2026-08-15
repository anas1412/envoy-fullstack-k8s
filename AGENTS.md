# AGENTS.md

Reference full-stack stack: product SPA + NestJS backend + Postgres + Envoy ingress, with Prometheus + Grafana monitoring all wired through the single Envoy gateway. Full architecture, routes, and runbooks live in `README.md`; this file only covers what agents get wrong.

## Shell: this environment uses fish

Bash-only syntax (`$(...)`, `VAR=x cmd`, `for/do/done`, `|| true`) fails at the shell level. Wrap any such command in `bash -c '...'`.

## Canonical configs must be synced into kustomize/base

- `envoy/envoy.yaml`, `postgres/init.sql`, `envoy/users.htpasswd` are the single sources of truth.
- Kustomize cannot read files above its kustomization root, so `kustomize/base/` holds generated mirrors. After editing a canonical file, run `./scripts/sync-configs.sh`. Never hand-edit the mirrors; a drift check is `diff envoy/envoy.yaml kustomize/base/envoy.yaml`.
- The monitoring configs (prometheus scrape config, grafana datasource/dashboard) live as inline `data` in `kustomize/base/prometheus-configmap.yaml` and `kustomize/base/grafana-configmap.yaml` — edit those directly, they are the source.

## Envoy gotchas (all verified against v1.39.0)

- `envoy/users.htpasswd` is Apache **htpasswd** format, and Envoy hashes the **password alone**, not `user:password`:
  `printf '%s' '<password>' | openssl dgst -sha1 -binary | base64` → write `user:{SHA}<hash>`.
- Per-route disable of basic auth uses `envoy.config.route.v3.FilterConfig` with `disabled: true`. `BasicAuthPerRoute` has no `disabled` field — it would fail `--mode validate`.
- The `envoyproxy/envoy` image has **no curl/wget/busybox/python**. To read admin stats (`:9901`) for debugging, exec into any container that has `fetch` (backend is Node 22) or just query Prometheus — `envoy-l4:9901/stats/prometheus` is scraped automatically.
- Envoy's `basic_auth` filter is global; routes must opt OUT with a `FilterConfig { disabled: true }` route override to stay open. `/grafana`, `/prometheus` and the write `/api/*` routes deliberately do NOT opt out, so they stay protected.

## Monitoring gotchas

- Envoy exposes Prometheus-format metrics natively at `envoy-l4:9901/stats/prometheus` — no exporter needed for Envoy. The Prometheus pod scrapes `envoy-l4:9901`, `postgres-exporter:9187` and itself; there is no NodePort for Prometheus, the UI is served through Envoy at `/prometheus`.
- Prometheus runs with `--web.route-prefix=/prometheus` + `--web.external-url=http://localhost:30080/prometheus`. The prefix must match the Envoy route — if it drifts, the UI breaks (asset 404s / wrong links). The k8s readiness probes are `tcpSocket` on purpose (path-independent). Same trap on the Grafana side: the Prometheus datasource URL must be `http://prometheus:9090/prometheus` (prefix included), because with route-prefix Prometheus 404s every un-prefixed path including `/api/v1/*` — an unprefixed datasource makes every panel empty while the datasource itself still shows as healthy.
- Grafana runs with `GF_SERVER_SERVE_FROM_SUB_PATH=true` + `GF_SERVER_ROOT_URL=http://localhost:30080/grafana/`. If root_url drifts from the Envoy route, login redirects break. Login is `admin` / `envoy-stack` (same creds as Envoy basic auth — the gateway prompts first, then Grafana's own login).
- The postgres-exporter dials Postgres **through** Envoy's L4 proxy (`envoy-l4:1999`) so its SQL also shows up in Envoy's counters — keep it that way. `DATA_SOURCE_NAME` is built from `db-creds` via `$(VAR)` substitution.
- Prometheus state lives on a PVC (`prometheus-data`, 2Gi, local-path). Deleting the PVC loses history; deleting the cluster via `k3d-down.sh` deletes it.

## Frontend gotchas

- The product app stores basic-auth creds in `localStorage` and sends `Authorization: Basic` manually on POST/PUT/DELETE, because `fetch()` 401s do not trigger the browser's native auth prompt. Reads stay open; only Envoy enforces auth (never the app).
- Frontend is Tailwind v4 (via `@tailwindcss/vite`); design tokens (`--color-*`) live in `frontend/product/src/index.css`. Palette is deliberately warm-ink + copper; keep new UI on those tokens, not new colors.

## Backend (NestJS)

- NestJS 11 + TypeORM + `@nestjs/terminus`, bootstrapped in `backend/src/main.ts` (global prefix `api`, custom error envelope filter, own JSON parser for exact wire-contract error messages).
- TypeORM connects through Envoy, never Postgres directly: `PG_HOST=envoy-l4` + `PG_PORT=1999` under K8s. `synchronize: false` — `postgres/init.sql` owns the schema; `backend/src/users/user.entity.ts` maps it 1:1 (including `created_at` on the wire).
- Health: `/api/health` is readiness (Terminus from `backend/src/health/health.controller.ts`, DB ping, 200/503 with `{status,info,error,details}`); `/api/healthz` is liveness (always 200). K8s probes: readiness httpGet `/api/health`, liveness httpGet `/api/healthz` — never downgrade liveness back to `tcpSocket`.
- The `ErrorEnvelopeFilter` passes Terminus payloads through untouched and wraps other HTTP errors as `{error: message}` to match the documented API contract. Don't break that.
- Commands: `npm run lint`, `npm run typecheck` (in `backend/`), `npm run dev` = `nest start --watch`, `npm run build` = `nest build`.

## Commands

- Lint/build: `(cd frontend/product && npm run lint && npm run build)`; backend: `npm run lint && npm run typecheck`.
- Envoy config validate: `docker run --rm -v $PWD/envoy/envoy.yaml:/etc/envoy/envoy.yaml:ro -v $PWD/envoy/users.htpasswd:/etc/envoy/users.htpasswd:ro envoyproxy/envoy:v1.39.0 --mode validate -c /etc/envoy/envoy.yaml`.
- Kustomize: use `kubectl kustomize` (no standalone kustomize binary); render with `kubectl kustomize kustomize/{base,overlays/dev,overlays/prod}`.

## K8s specifics

- `db-creds` Secret (POSTGRES_USER/PASSWORD/DB) is created imperatively before apply — **never** put DB creds in any manifest. `kubectl create secret generic db-creds --from-literal=...`.
- Only the `envoy` Service is external (NodePort 30080). `envoy-l4` (ClusterIP) carries the L4 Postgres proxy `:1999` and admin `:9901` for in-cluster consumers (backend, postgres-exporter, Prometheus). Envoy pod runs uid 101 with `NET_BIND_SERVICE`; don't drop the capability or `:80` won't bind.
- Postgres 18 image refuses to start unless its data volume mounts at `/var/lib/postgresql` (not `/var/lib/postgresql/data`) — the StatefulSet must keep that path.
- `k3d-up.sh` applies with `kubectl apply -k kustomize/base --prune -l stack=envoy-stack`, so removing a resource from the base also removes it from a running cluster.

## Verification (there are no automated tests, no CI)

Manual acceptance = `bash scripts/k3d-up.sh`, then: reads return 200 (`/api/users`, `/api/health` — Terminus shape with `status:"ok"`, `/api/healthz`), writes 401 without creds / 201 with, `/grafana` and `/prometheus` return 401 without creds / 200 with (login admin/envoy-stack), Prometheus targets are all UP (query `http://localhost:30080/prometheus/api/v1/targets` with basic auth and check the `health` fields), the Grafana "Envoy Stack" dashboard shows live Envoy counters (query `pg_up` and `envoy_server_uptime` return values via the Prometheus API), and the DB recovery cycle (scale postgres to 0 → `/api/health` 503 → scale back → 200 within ~10 s, no backend restart).

## Cleanup

This repo is expected to leave nothing running after verification. The k3d path is fully scripted: `bash scripts/k3d-up.sh` (idempotent: build + create cluster + import + secret + apply --prune + wait) and `bash scripts/k3d-down.sh` (delete cluster + remove dev images). Default basic-auth creds: `admin` / `envoy-stack`. (K8s path runs on k3d, not kind; k3s ships `local-path` as the default StorageClass so the Postgres and Prometheus PVCs bind with no provisioning.)
