# Envoy Full-Stack K8s Reference Stack

![Envoy v1.39](https://img.shields.io/badge/Envoy-v1.39.0-181717)
![PostgreSQL 18](https://img.shields.io/badge/PostgreSQL-18-181717)
![Bun 1.3](https://img.shields.io/badge/Bun-1.3-181717)
![React 19](https://img.shields.io/badge/React-19-181717)
![Kustomize](https://img.shields.io/badge/Kustomize-native-181717)

A production-shaped, containerized full-stack reference application: a CRUD
product frontend, an Envoy monitoring dashboard, a Bun backend, PostgreSQL, and
Envoy Proxy as the **single** network ingress. Deploy it locally with Docker
Compose or to Kubernetes with Kustomize.

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
| Deployment | Docker Compose (local) and Kustomize base/dev/prod (K8s) |

## Prerequisites

- Docker with Compose v2 (local run)
- Node 20+ and Bun 1.3+ (component development only)
- `kubectl` 1.27+ (ships built-in Kustomize) and k3d v5+ (for the K8s path)

## Quick start (Docker Compose)

### 1. Configure

```bash
cp .env.example .env    # set the PG_* values (never commit .env)
```

### 2. Start

```bash
docker compose up --build
```

### 3. Open

| URL | What |
|---|---|
| http://localhost/ | Product app (CRUD) |
| http://localhost/monitor | Monitor dashboard (basic auth prompt) |
| http://localhost/api/users | Raw API (read) |

Default basic-auth credentials: **`admin` / `envoy-stack`** (see
[Changing the auth credentials](#changing-the-auth-credentials)).

### Verify the path

```bash
curl http://localhost/api/users          # seeded JSON rows
curl http://localhost/api/health         # {"status":"ok","database":"up"}

# write without creds → 401
curl -X POST http://localhost/api/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Nope","email":"nope@example.com","role":"viewer"}'

# write with creds → 201
curl -u admin:envoy-stack -X POST http://localhost/api/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Grace Testing","email":"grace.testing@example.com","role":"editor"}'

curl http://localhost/api/envoy/stats | python3 -m json.tool
```

Watch Envoy's raw counters live. The Envoy image has no `curl`, so query the
admin interface from inside the backend container:

```bash
docker compose exec backend bun -e '
  const t = await (await fetch("http://envoy:9901/stats")).text();
  console.log(
    t.split("\n")
     .filter(l => l.includes("cluster.postgres.upstream_cx_active")
              || l.includes("cluster.backend.upstream_rq_total"))
     .join("\n")
  )'
```

While the product app runs a query, `cluster.postgres.upstream_cx_active` and
its byte counters should be non-zero: that is the L4 proxy carrying a real
database conversation.

### Postgres recovery test

```bash
docker compose stop postgres
curl http://localhost/api/health         # HTTP 503, database down

docker compose start postgres
# ~5-10 s later, no backend restart needed:
curl http://localhost/api/health         # HTTP 200, database up again
```

## Deploy to Kubernetes (k3d + Kustomize)

### One command, everything automatic

The full K8s path is scripted: build images, create the cluster, import the
images, create the DB secret, apply, and wait for readiness:

```bash
./scripts/k3d-up.sh      # stack up at http://localhost:30080/
./scripts/k3d-down.sh    # cluster deleted, images removed, nothing left
```

`k3d-up.sh` is idempotent - re-running it rebuilds and re-imports images and
re-applies the manifests against the existing cluster. The `prod` overlay
(`kubectl apply -k kustomize/overlays/prod`) is the only manual variant, for
3x replicas and larger limits.

### What the script does (the underlying commands)

The manifests reference `envoy-stack/{product,monitor,backend}:dev` (the prod
overlay switches to `:prod` tags). The NodePort on Envoy's gateway Service is
`30080`; the cluster maps it to localhost:

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

Notes:

- k3s ships the `local-path` StorageClass by default, so the Postgres PVC
  binds automatically - no storage provisioner setup needed.
- Database credentials are intentionally **not** in any manifest; the secret
  is created at up time.
- The only externally reachable Service is Envoy's L7 gateway, so all routes
  land on `localhost:30080`:

  ```bash
  open http://localhost:30080/            # product app
  open http://localhost:30080/monitor     # monitor dashboard (basic auth)
  ```

Preview overlays without applying:

```bash
kubectl kustomize kustomize/base
kubectl kustomize kustomize/overlays/prod
```

## Security notes

- **No secrets in YAML.** DB credentials come from the `db-creds` Secret
  (created at apply time); Envoy's auth users come from a generated Secret
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

Then sync the packaged copy into `kustomize/base/` and restart Envoy
(compose or K8s):

```bash
./scripts/sync-configs.sh
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
  at Postgres directly (`PG_HOST=localhost PG_PORT=5432`), or run it through
  the compose stack to exercise the L4 proxy.
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
