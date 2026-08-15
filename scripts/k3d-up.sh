#!/usr/bin/env bash
# Bring the full stack up on k3d with one command.
#   ./scripts/k3d-up.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Building images"
docker build -q -t envoy-stack/product:dev frontend/product
docker build -q -t envoy-stack/backend:dev backend

echo "==> Creating cluster (if needed)"
if ! k3d cluster list 2>/dev/null | grep -q '^envoy-stack'; then
  k3d cluster create envoy-stack --port 30080:30080@loadbalancer --wait
fi

echo "==> Importing images"
k3d image import envoy-stack/product:dev envoy-stack/backend:dev -c envoy-stack

echo "==> Creating db-creds secret (idempotent)"
kubectl create secret generic db-creds \
  --from-literal=POSTGRES_USER=postgres \
  --from-literal=POSTGRES_PASSWORD=postgres \
  --from-literal=POSTGRES_DB=app \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null

echo "==> Applying kustomize base (pruning removed resources)"
kubectl apply -k kustomize/base --prune -l stack=envoy-stack

echo "==> Waiting for rollouts"
# Postgres first: the backend refuses to serve until its DB connection is up,
# so deployments (whose readiness gate is the DB-backed /api/health) must wait
# for the database to be Ready before they can converge.
kubectl rollout status statefulset -l stack=envoy-stack --timeout=240s
kubectl rollout status deployment -l stack=envoy-stack --timeout=240s

echo
echo "==> Up. URLs (basic auth: admin / envoy-stack):"
echo "    product     http://localhost:30080/"
echo "    grafana     http://localhost:30080/grafana   (login: admin / envoy-stack)"
echo "    prometheus  http://localhost:30080/prometheus"
echo "    api         http://localhost:30080/api/users"
