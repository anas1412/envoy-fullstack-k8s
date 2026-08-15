#!/usr/bin/env bash
# Mirrors the canonical component configs into kustomize/base so that
# `kubectl apply -k` can package them into ConfigMaps/Secrets without
# Kustomize's "file must be below the kustomization root" restriction.
#
# Run this after editing envoy/envoy.yaml, postgres/init.sql or
# envoy/users.htpasswd. The files in kustomize/base are generated snapshots:
# they should be committed, and never hand-edited.
set -euo pipefail

cd "$(dirname "$0")/.."

cp envoy/envoy.yaml            kustomize/base/envoy.yaml
cp postgres/init.sql           kustomize/base/init.sql
cp envoy/users.htpasswd        kustomize/base/users.htpasswd

echo "synced: envoy/envoy.yaml, postgres/init.sql, envoy/users.htpasswd -> kustomize/base/"
