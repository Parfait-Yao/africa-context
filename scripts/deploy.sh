#!/bin/sh
# Déploiement sur le VPS : ./scripts/deploy.sh
set -eu
git pull --ff-only
docker compose --profile prod build
docker compose --profile prod up -d
docker compose --profile prod ps
sleep 5
curl -fsS "https://${DOMAIN:-localhost}/api/health" && echo "\n✔ Déployé"
