#!/usr/bin/env bash
# Stop and remove the Prelegal container.
docker rm -f prelegal >/dev/null 2>&1 || true
echo "Prelegal stopped"
