#!/usr/bin/env bash
# Bring the full stack up on k3d with one command.
#   ./scripts/k3d-up.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Building images"
docker build -q -t envoy-stack/product:dev frontend/product
docker build -q -t envoy-stack/monitor:dev frontend/monitor
docker build -q -t envoy-stack/backend:dev backend

echo "==> Creating cluster (if needed)"
if ! k3d cluster list 2>/dev/null | grep -q '^envoy-stack'; then
  k3d cluster create envoy-stack --port 30080:30080@loadbalancer --wait
fi

echo "==> Importing images"
k3d image import envoy-stack/product:dev envoy-stack/monitor:dev envoy-stack/backend:dev -c envoy-stack

echo "==> Creating db-creds secret (idempotent)"
kubectl create secret generic db-creds \
  --from-literal=POSTGRES_USER=postgres \
  --from-literal=POSTGRES_PASSWORD=postgres \
  --from-literal=POSTGRES_DB=app \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null

echo "==> Applying kustomize base"
kubectl apply -k kustomize/base

echo "==> Waiting for rollouts"
kubectl rollout status deployment -l stack=envoy-stack --timeout=240s
kubectl rollout status statefulset -l stack=envoy-stack --timeout=240s

echo
echo "==> Up. URLs (basic auth: admin / envoy-stack):"
echo "    product  http://localhost:30080/"
echo "    monitor  http://localhost:30080/monitor"
echo "    api      http://localhost:30080/api/users"
