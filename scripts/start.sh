#!/usr/bin/env bash
# Build the Prelegal image and run it at http://localhost:8000 (a fresh database every start).
set -euo pipefail
cd "$(dirname "$0")/.."

env_args=()
[ -f .env ] && env_args=(--env-file .env)

docker build -t prelegal .
docker rm -f prelegal >/dev/null 2>&1 || true
docker run -d --name prelegal -p 8000:8000 ${env_args[@]+"${env_args[@]}"} prelegal >/dev/null
echo "Prelegal is running at http://localhost:8000"
