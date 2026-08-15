# Envoy Full-Stack K8s Reference Stack

![Envoy v1.39](https://img.shields.io/badge/Envoy-v1.39.0-181717)
![PostgreSQL 18](https://img.shields.io/badge/PostgreSQL-18-181717)
![Bun 1.3](https://img.shields.io/badge/Bun-1.3-181717)
![React 19](https://img.shields.io/badge/React-19-181717)
![Kustomize](https://img.shields.io/badge/Kustomize-native-181717)

A production-shaped, containerized full-stack reference application: a CRUD
product frontend, an Envoy monitoring dashboard, a Bun backend, PostgreSQL, and
Envoy Proxy as the **single** network ingress - deployed to Kubernetes with
Kustomize on k3d.

## Preview

![Envoy full-stack stack running](example.png)

## Quick start (k3d)

One command brings up the whole stack - builds images, creates the cluster,
imports the images, creates the DB secret, applies the manifests, and waits
for everything to be ready:

```bash
./scripts/k3d-up.sh      # stack up at http://localhost:30080/
./scripts/k3d-down.sh    # cluster deleted, images removed, nothing left running
```

Open:

| URL | What |
|---|---|
| http://localhost:30080/ | Product app (CRUD) |
| http://localhost:30080/monitor | Monitor dashboard (basic auth) |
| http://localhost:30080/api/users | Raw API (read) |

Default basic-auth credentials: **`admin` / `envoy-stack`** (see
[Changing the auth credentials](#changing-the-auth-credentials)).

`k3d-up.sh` is idempotent - re-running it rebuilds and re-imports images and
re-applies the manifests against the existing cluster. The `prod` overlay
(`kubectl apply -k kustomize/overlays/prod`) is the only manual variant, for
3x replicas and larger limits.

### What the script does (the underlying commands)

```bash
docker build -t envoy-stack/product:dev frontend/product
docker build -t envoy-stack/monitor:dev frontend/monitor
docker build -t envoy-stack/backend:dev backend

k3d cluster create envoy-stack --port 30080:30080@loadbalancer
k3d image import \
  envoy-stack/product:dev envoy-stack/monitor:dev envoy-stack/backend:dev \
  -c envoy-stack

kubectl create secret generic db-creds \
  --from-literal=POSTGRES_USER=postgres \
  --from-literal=POSTGRES_PASSWORD=postgres \
  --from-literal=POSTGRES_DB=app

kubectl apply -k kustomize/base
kubectl rollout status deployment -l stack=envoy-stack --timeout=180s
kubectl rollout status statefulset -l stack=envoy-stack --timeout=180s
```

### Verify

```bash
curl http://localhost:30080/api/users      # seeded JSON rows
curl http://localhost:30080/api/health     # {"status":"ok","database":"up"}

# write without creds → 401
curl -X POST http://localhost:30080/api/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Nope","email":"nope@example.com","role":"viewer"}'

# write with creds → 201
curl -u admin:envoy-stack -X POST http://localhost:30080/api/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Grace Testing","email":"grace.testing@example.com","role":"editor"}'

curl http://localhost:30080/api/envoy/stats | python3 -m json.tool
```

Notes:

- k3s ships the `local-path` StorageClass by default, so the Postgres PVC
  binds automatically - no storage provisioner setup needed.
- Database credentials are intentionally **not** in any manifest; the secret
  is created at up time.
- The only externally reachable Service is Envoy's L7 gateway (NodePort
  `30080`), so all routes land on `localhost:30080`.

Preview overlays without applying:

```bash
kubectl kustomize kustomize/base
kubectl kustomize kustomize/overlays/prod
```

## Features

- **Single L7 gateway** - one Envoy route table fans out to three targets
  (product, monitor, backend).
- **L4 Postgres proxying** - the backend never dials Postgres directly; every
  SQL conversation flows through Envoy, so Envoy's live counters prove the
  database path is real.
- **Per-route basic auth** - write endpoints and the monitor dashboard are gated
  by Envoy's `basic_auth` filter; read endpoints stay open. Auth is enforced at
  the gateway, never in the app.
- **Envoy stats as JSON** - the monitor dashboard renders real Envoy counters
  fetched from the internal admin interface.
- **Environment parity** - `dev` and `prod` Kustomize overlays differ only by
  tuning (replicas, resources, image tags), never by structure.

## Architecture

```
               ┌─▶ /          Product (React + Nginx, CRUD UI)         [open]
Browser ──▶ Envoy (L7 :80) ─┼─▶ /monitor* Monitor (React + Nginx)     [auth]
               └─▶ /api/*    Backend (Bun :3000)  GET/HEAD [open]
                                                        POST/PUT/DELETE [auth]

Backend ──▶ Envoy (L4 :1999) ──▶ PostgreSQL 5432   (raw TCP, proxied)
Backend ──▶ Envoy (admin :9901)                    (stats → /api/envoy/stats)
```

### L7 route table (Envoy, port 80)

| Path | Cluster | Auth |
|---|---|---|
| `/monitor*` | monitor (Nginx, port 80) | required |
| `/api/*` GET/HEAD | backend (Bun, port 3000) | open |
| `/api/*` POST/PUT/DELETE | backend | required |
| `/` (and SPA fallback) | product (Nginx, port 80) | open |

### L4 route table (Envoy, port 1999)

| Listener | Protocol | Cluster |
|---|---|---|
| `postgres_listener` | raw TCP (Postgres wire) | postgres (port 5432) |

### Backend API

| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `/api/users` | GET | no | list users (JSON) |
| `/api/users` | POST | yes | create user, `201` |
| `/api/users/:id` | PUT | yes | update user |
| `/api/users/:id` | DELETE | yes | delete user |
| `/api/health` | GET | no | `200` DB up / `503` DB down |
| `/api/envoy/stats` | GET | no | parsed Envoy admin stats (JSON) |

## Tech stack

| Layer | Choice |
|---|---|
| Frontends | React 19 + Vite + Tailwind v4, served by Nginx (two apps, two images) |
| Backend | Bun (no framework, `Bun.serve`), `postgres` driver |
| Database | PostgreSQL 18, seeded by `init.sql` on first boot |
| Gateway | Envoy Proxy v1.39.0 (L7 + L4 listeners, `basic_auth`, admin stats) |
| Deployment | Kustomize base/dev/prod on k3d (k3s) |

## Prerequisites

- Docker (to build the images)
- k3d v5+ (runs k3s; provides the cluster and image import)
- `kubectl` 1.27+ (ships built-in Kustomize)
- Node 20+ and Bun 1.3+ (component development only)

## Security notes

- **No secrets in YAML.** DB credentials come from the `db-creds` Secret
  (created at up time); Envoy's auth users come from a generated Secret
  (`envoy-users`) built by Kustomize from the hashed `users.htpasswd`. The
  htpasswd file holds `{SHA}` hashes, never plaintext passwords.
- **Exposure.** Only the `envoy` L7 Service (NodePort) is external. The L4
  proxy and admin stats are ClusterIP-only (`envoy-l4`), reachable only from
  inside the cluster.
- **Read vs write.** `GET /api/*` is open; POST/PUT/DELETE and `/monitor*`
  require basic auth, enforced at the gateway (Envoy), not in the app.

### Changing the auth credentials

Generate a new htpasswd line. Envoy's `{SHA}` hashes the **password alone**
(not `user:password`):

```bash
printf '%s' 'your-new-password' | openssl dgst -sha1 -binary | base64
# → write "admin:{SHA}<hash>" to envoy/users.htpasswd
```

Then sync the packaged copy into `kustomize/base/` and restart Envoy:

```bash
./scripts/sync-configs.sh
kubectl rollout restart deployment/envoy
```

## Development

- **Config sync contract.** `envoy/envoy.yaml`, `postgres/init.sql` and
  `envoy/users.htpasswd` are the canonical sources. `kustomize/base/` holds
  generated snapshots of them (Kustomize cannot read files above its
  kustomization root). After editing a canonical file, run
  `./scripts/sync-configs.sh` and commit the sync. Never hand-edit the
  snapshots.
- **Frontends.** `cd frontend/product && npm run dev` (Vite on `:5173`). The
  monitor app must keep `base: '/monitor/'` in its `vite.config.ts` so its
  assets route through the `/monitor` Envoy path.
- **Backend.** `cd backend && npm run dev`. For component-local work point it
  at Postgres directly (`PG_HOST=localhost PG_PORT=5432`), or run the full
  stack with `./scripts/k3d-up.sh` to exercise the L4 proxy end to end.
- **Checks.** `npm run lint`, `npm run build` (frontends), `npm run typecheck`
  (backend), and validate the Envoy config:

  ```bash
  docker run --rm \
    -v $PWD/envoy/envoy.yaml:/etc/envoy/envoy.yaml:ro \
    -v $PWD/envoy/users.htpasswd:/etc/envoy/users.htpasswd:ro \
    envoyproxy/envoy:v1.39.0 --mode validate -c /etc/envoy/envoy.yaml
  ```

## Out of scope (v1)

User accounts/JWT auth (Envoy basic auth only), TLS termination at Envoy,
metrics scraping/tracing, Postgres HA/replication, Helm, CI/CD.
