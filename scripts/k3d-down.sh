#!/usr/bin/env bash
# Tear the k3d stack down and remove local dev images.
#   ./scripts/k3d-down.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Deleting cluster"
k3d cluster delete envoy-stack 2>/dev/null || true

echo "==> Removing dev images"
docker rmi envoy-stack/product:dev envoy-stack/backend:dev 2>/dev/null || true

echo "==> Down. Nothing left running."
