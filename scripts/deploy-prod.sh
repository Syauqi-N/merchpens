#!/bin/sh

# Deploy image yang tag-nya sudah diisi pada APP_TAG di .env production.
# Script tidak pernah build source di VPS. Sebelum migrasi dijalankan oleh
# container baru, database aktif dicadangkan ke ./backups/.

set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"

if [ ! -f .env ]; then
  echo "GAGAL: .env production tidak ditemukan."
  exit 1
fi

docker compose -f "$COMPOSE_FILE" config --quiet

db_container="$(docker compose -f "$COMPOSE_FILE" ps -q db 2>/dev/null || true)"
if [ -n "$db_container" ] && [ "$(docker inspect -f '{{.State.Running}}' "$db_container")" = "true" ]; then
  mkdir -p "$BACKUP_DIR"
  stamp="$(date +%Y%m%d-%H%M%S)"
  backup_sql="$BACKUP_DIR/.database-before-deploy-$stamp.sql"
  backup_file="$BACKUP_DIR/database-before-deploy-$stamp.sql.gz"

  cleanup_backup_sql() {
    rm -f "$backup_sql"
  }

  trap cleanup_backup_sql EXIT HUP INT TERM
  echo "Membuat backup database: $backup_file"
  docker compose -f "$COMPOSE_FILE" exec -T db \
    sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$backup_sql"
  test -s "$backup_sql"
  gzip -c "$backup_sql" > "$backup_file"
  cleanup_backup_sql
  trap - EXIT HUP INT TERM
  test -s "$backup_file"
else
  echo "Database belum berjalan; backup dilewati untuk initial deployment."
fi

echo "Menarik image APP_IMAGE:APP_TAG yang ditetapkan di .env..."
docker compose -f "$COMPOSE_FILE" pull app cron

echo "Mengaktifkan release baru..."
docker compose -f "$COMPOSE_FILE" up -d --no-build db app cron nginx

docker compose -f "$COMPOSE_FILE" ps
echo "Deploy selesai. Pantau dengan: docker compose -f $COMPOSE_FILE logs -f app"
