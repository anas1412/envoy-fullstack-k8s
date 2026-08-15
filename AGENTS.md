# AGENTS.md

Reference full-stack stack: 5 components (product + monitor SPAs, Bun backend, Postgres, Envoy) wired through a single Envoy ingress. Full architecture, routes, and runbooks live in `README.md`; this file only covers what agents get wrong.

## Shell: this environment uses fish

Bash-only syntax (`$(...)`, `VAR=x cmd`, `for/do/done`, `|| true`) fails at the shell level. Wrap any such command in `bash -c '...'`.

## Canonical configs must be synced into kustomize/base

- `envoy/envoy.yaml`, `postgres/init.sql`, `envoy/users.htpasswd` are the single sources of truth.
- Kustomize cannot read files above its kustomization root, so `kustomize/base/` holds generated mirrors. After editing a canonical file, run `./scripts/sync-configs.sh`. Never hand-edit the mirrors; a drift check is `diff envoy/envoy.yaml kustomize/base/envoy.yaml`.
- Compose mounts the canonical files directly; only the K8s path needs the sync.

## Envoy gotchas (all verified against v1.39.0)

- `envoy/users.htpasswd` is Apache **htpasswd** format, and Envoy hashes the **password alone**, not `user:password`:
  `printf '%s' '<password>' | openssl dgst -sha1 -binary | base64` → write `user:{SHA}<hash>`.
- Per-route disable of basic auth uses `envoy.config.route.v3.FilterConfig` with `disabled: true`. `BasicAuthPerRoute` has no `disabled` field — it would fail `--mode validate`.
- The `envoyproxy/envoy` image has **no curl/wget/busybox/python**. To read admin stats (`:9901`), exec into the backend container: `docker compose exec backend bun -e 'const r = await fetch("http://envoy:9901/stats"); console.log(await r.text())'`.

## Frontend gotchas

- `frontend/monitor` MUST keep `base: '/monitor/'` in `vite.config.ts`. If reset to `/`, its assets serve at `/assets/*`, match the `/` catch-all, and route to the product service instead — dashboard breaks. After any source change, rebuild via `./scripts/k3d-up.sh` (it rebuilds and re-imports all images) or, for a quick iteration: `docker compose build monitor && k3d image import envoy-stack/monitor:dev -c envoy-stack`.
- The monitor image's `nginx.conf` MUST strip the `/monitor` prefix (`location /monitor` with `rewrite ^/monitor/?$ /index.html break;` + `rewrite ^/monitor/(.*)$ /$1 break;`). Vite builds with `base: '/monitor/'`, so the HTML references `/monitor/assets/*`, but the files live at `/usr/share/nginx/html/assets/`. Without the rewrite, `try_files` falls back to `index.html` for every asset (200 text/html) and the browser refuses to run it as a module → white page. Verify by content-type, not status code: assets must be `application/javascript`/`text/css`.
- The product app stores basic-auth creds in `localStorage` and sends `Authorization: Basic` manually on POST/PUT/DELETE, because `fetch()` 401s do not trigger the browser's native auth prompt. Reads stay open; only Envoy enforces auth (never the app).
- Frontends are Tailwind v4 (via `@tailwindcss/vite`); design tokens (`--color-*`) live in each app's `src/index.css`. Palette is deliberately warm-ink + copper; keep new UI on those tokens, not new colors.

## Backend (Bun)

- No framework — `Bun.serve` in `backend/src/index.ts`. DB is the `postgres` package, not `pg`.
- Backend env points at Envoy, never Postgres directly: `PG_HOST=envoy` + `PG_PORT=1999` + `ENVOY_ADMIN=http://envoy:9901` under compose; `PG_HOST=envoy-l4` under K8s.
- Commands: `npm run lint`, `npm run typecheck` (in `backend/`), `npm run dev` = `bun --watch`.

## Commands

- Lint/build all: `(cd frontend/product && npm run lint && npm run build)`, same for `frontend/monitor`; backend: `npm run lint && npm run typecheck`.
- Envoy config validate: `docker run --rm -v $PWD/envoy/envoy.yaml:/etc/envoy/envoy.yaml:ro -v $PWD/envoy/users.htpasswd:/etc/envoy/users.htpasswd:ro envoyproxy/envoy:v1.39.0 --mode validate -c /etc/envoy/envoy.yaml`.
- Kustomize: use `kubectl kustomize` (no standalone kustomize binary); render all three with `kubectl kustomize kustomize/{base,overlays/dev,overlays/prod}`.
- Compose needs `.env` first (`cp .env.example .env`); `${PG_*:?}` vars fail fast without it. Compose project name is pinned to `envoy-stack` by `compose.yaml`, so a second stack needs `-p <name>`.

## K8s specifics

- `db-creds` Secret (POSTGRES_USER/PASSWORD/DB) is created imperatively before apply — **never** put DB creds in any manifest. `kubectl create secret generic db-creds --from-literal=...`.
- Only the `envoy` Service is external (NodePort 30080). `envoy-l4` (ClusterIP) carries the L4 Postgres proxy `:1999` and admin `:9901` for the in-cluster backend. Envoy pod runs uid 101 with `NET_BIND_SERVICE`; don't drop the capability or `:80` won't bind.
- Postgres 18 image refuses to start unless its data volume mounts at `/var/lib/postgresql` (not `/var/lib/postgresql/data`) — compose and the StatefulSet must keep that path.

## Verification (there are no automated tests, no CI)

Manual acceptance = compose up, then: reads return 200 (`/api/users`, `/api/health`), writes 401 without creds / 201 with, `/monitor` 401/200 with its JS/CSS assets returning `application/javascript`/`text/css` (not `text/html` — a status-only check passes on the SPA fallback and misses a broken asset path), `/api/envoy/stats` shows a live `postgres` cluster, and the DB recovery cycle (stop postgres → `/api/health` 503 → start → 200 within ~10 s, no backend restart).

## Cleanup

This repo is expected to leave nothing running after verification. The k3d path is fully scripted: `bash scripts/k3d-up.sh` (idempotent: build + create cluster + import + secret + apply + wait) and `bash scripts/k3d-down.sh` (delete cluster + remove dev images). Local compose teardown is `docker compose down`. Default basic-auth creds: `admin` / `envoy-stack`. (K8s path runs on k3d, not kind; k3s ships `local-path` as the default StorageClass so the Postgres PVC binds with no provisioning.)
