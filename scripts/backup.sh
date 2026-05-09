#!/bin/sh
# Backup automatizado do Casa Roxa Gestão.
#
# Faz dump comprimido do Postgres + tar do volume de uploads, e remove
# arquivos com mais de RETENTION_DAYS dias.
#
# Uso (manual):
#   ./scripts/backup.sh
#
# Uso (cron diário, 3h da manhã):
#   0 3 * * * /opt/casaroxa/backup.sh >> /var/log/casa-roxa-backup.log 2>&1
#
# Variáveis de ambiente (com defaults):
#   STACK_NAME          (default: casaroxa)
#   BACKUP_DIR          (default: /var/backups/casa-roxa)
#   RETENTION_DAYS      (default: 30)
#   POSTGRES_USER       (default: casaroxa)
#   POSTGRES_DB         (default: casa_roxa)

set -e

STACK_NAME="${STACK_NAME:-casaroxa}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/casa-roxa}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
POSTGRES_USER="${POSTGRES_USER:-casaroxa}"
POSTGRES_DB="${POSTGRES_DB:-casa_roxa}"
TIMESTAMP=$(date +%F_%H%M)

mkdir -p "$BACKUP_DIR/postgres"
mkdir -p "$BACKUP_DIR/uploads"

# ---------- Postgres ----------
PG_CONTAINER=$(docker ps -qf "name=${STACK_NAME}_postgres" | head -1)
if [ -z "$PG_CONTAINER" ]; then
  echo "✗ Container do Postgres não encontrado (esperado: ${STACK_NAME}_postgres.*)"
  exit 1
fi

echo "→ [Postgres] dump de '$POSTGRES_DB' (container $PG_CONTAINER)..."
docker exec "$PG_CONTAINER" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > "$BACKUP_DIR/postgres/${POSTGRES_DB}_${TIMESTAMP}.sql.gz"
echo "  ✓ $BACKUP_DIR/postgres/${POSTGRES_DB}_${TIMESTAMP}.sql.gz"

# ---------- Uploads (volume Docker) ----------
UPLOADS_VOLUME="${STACK_NAME}_casa_roxa_uploads"
if docker volume inspect "$UPLOADS_VOLUME" >/dev/null 2>&1; then
  echo "→ [Uploads] tar do volume '$UPLOADS_VOLUME'..."
  docker run --rm \
    -v "${UPLOADS_VOLUME}:/data:ro" \
    -v "$BACKUP_DIR/uploads:/backup" \
    alpine tar czf "/backup/uploads_${TIMESTAMP}.tar.gz" -C /data . 2>/dev/null
  echo "  ✓ $BACKUP_DIR/uploads/uploads_${TIMESTAMP}.tar.gz"
else
  echo "→ [Uploads] volume '$UPLOADS_VOLUME' não existe — pulando"
fi

# ---------- Retenção ----------
echo "→ Removendo backups com mais de $RETENTION_DAYS dias..."
find "$BACKUP_DIR/postgres" -name "*.sql.gz" -mtime "+$RETENTION_DAYS" -delete 2>/dev/null || true
find "$BACKUP_DIR/uploads" -name "*.tar.gz" -mtime "+$RETENTION_DAYS" -delete 2>/dev/null || true

# ---------- Resumo ----------
echo ""
echo "✓ Backup concluído em $BACKUP_DIR"
du -sh "$BACKUP_DIR/postgres" "$BACKUP_DIR/uploads" 2>/dev/null || true
