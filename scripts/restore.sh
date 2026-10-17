#!/bin/sh
# Restauration : ./scripts/restore.sh backups/africontext-20261024-013000.sql.gz
# ⚠️ Remplace TOUTES les données actuelles.
set -eu
[ -f "${1:-}" ] || { echo "Usage : $0 <fichier.sql.gz>"; exit 1; }
printf "Restaurer %s et écraser la base actuelle ? (oui/non) " "$1"; read -r ok; [ "$ok" = "oui" ] || exit 1
docker compose stop app cron
docker compose exec -T db psql -U "${POSTGRES_USER:-africontext}" -d postgres -c "DROP DATABASE IF EXISTS ${POSTGRES_DB:-africontext};" -c "CREATE DATABASE ${POSTGRES_DB:-africontext};"
gunzip -c "$1" | docker compose exec -T db psql -U "${POSTGRES_USER:-africontext}" "${POSTGRES_DB:-africontext}"
docker compose start app cron
echo "✔ Base restaurée depuis $1"
