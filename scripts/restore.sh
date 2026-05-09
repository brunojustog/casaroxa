#!/bin/sh
# Restore de backup do Casa Roxa.
#
# CUIDADO: este script SUBSTITUI os dados atuais. Use apenas em casos
# de desastre ou quando você souber exatamente o que está fazendo.
#
# Uso:
#   ./scripts/restore.sh <postgres_dump.sql.gz> [<uploads.tar.gz>]
#
# Exemplo:
#   ./scripts/restore.sh /var/backups/casa-roxa/postgres/casa_roxa_2026-05-08.sql.gz \
#                        /var/backups/casa-roxa/uploads/uploads_2026-05-08.tar.gz

set -e

STACK_NAME="${STACK_NAME:-casaroxa}"
POSTGRES_USER="${POSTGRES_USER:-casaroxa}"
POSTGRES_DB="${POSTGRES_DB:-casa_roxa}"

PG_DUMP="${1:?Uso: $0 <postgres_dump.sql.gz> [<uploads.tar.gz>]}"
UPLOADS_TAR="$2"

if [ ! -f "$PG_DUMP" ]; then
  echo "✗ Arquivo de dump não encontrado: $PG_DUMP"
  exit 1
fi

echo "⚠ ATENÇÃO: isto VAI SUBSTITUIR os dados atuais."
printf "Digite o nome do banco para confirmar (%s): " "$POSTGRES_DB"
read -r CONFIRM
if [ "$CONFIRM" != "$POSTGRES_DB" ]; then
  echo "✗ Confirmação incorreta. Abortando."
  exit 1
fi

PG_CONTAINER=$(docker ps -qf "name=${STACK_NAME}_postgres" | head -1)
if [ -z "$PG_CONTAINER" ]; then
  echo "✗ Container do Postgres não encontrado"
  exit 1
fi

echo "→ Restaurando Postgres a partir de $PG_DUMP..."
gunzip < "$PG_DUMP" | docker exec -i "$PG_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
echo "  ✓ Postgres restaurado"

if [ -n "$UPLOADS_TAR" ]; then
  if [ ! -f "$UPLOADS_TAR" ]; then
    echo "✗ Arquivo de uploads não encontrado: $UPLOADS_TAR"
    exit 1
  fi
  UPLOADS_VOLUME="${STACK_NAME}_casa_roxa_uploads"
  echo "→ Restaurando uploads no volume '$UPLOADS_VOLUME'..."
  docker run --rm \
    -v "${UPLOADS_VOLUME}:/data" \
    -v "$(dirname "$(readlink -f "$UPLOADS_TAR")"):/backup:ro" \
    alpine sh -c "rm -rf /data/* && tar xzf /backup/$(basename "$UPLOADS_TAR") -C /data"
  echo "  ✓ Uploads restaurados"
fi

echo ""
echo "✓ Restore concluído. Pode ser necessário reiniciar a app:"
echo "  docker service update --force ${STACK_NAME}_app"
