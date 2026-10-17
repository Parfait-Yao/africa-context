#!/bin/sh
# Sauvegarde quotidienne de PostgreSQL (rétention 7 jours).
# Cron du VPS : 30 1 * * * cd /opt/africontext && ./scripts/backup.sh >> backups/backup.log 2>&1
set -eu
mkdir -p backups
FILE="backups/africontext-$(date +%Y%m%d-%H%M%S).sql.gz"
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-africontext}" "${POSTGRES_DB:-africontext}" | gzip > "$FILE"
find backups -name 'africontext-*.sql.gz' -mtime +7 -delete
echo "✔ Sauvegarde : $FILE ($(du -h "$FILE" | cut -f1))"
