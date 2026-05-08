#!/bin/sh
# Entrypoint do container de produção (Docker Swarm friendly).
# - Espera o Postgres aceitar conexão (Swarm não respeita depends_on.condition).
# - Roda migrations Prisma (idempotente — não reaplica o que já está no banco).
# - Roda seed (idempotente — admin é upserted).
# - Sobe o Next.

set -e

# DATABASE_URL é obrigatória — extrai host/porta para o probe.
if [ -z "$DATABASE_URL" ]; then
  echo "✗ DATABASE_URL não configurada." >&2
  exit 1
fi

# Extrai host e porta da DATABASE_URL via expressão básica POSIX
DB_HOST_PORT=$(echo "$DATABASE_URL" | sed -E 's#^[^@]+@([^/]+)/.*$#\1#')
DB_HOST=$(echo "$DB_HOST_PORT" | cut -d: -f1)
DB_PORT=$(echo "$DB_HOST_PORT" | cut -d: -f2)
[ -z "$DB_PORT" ] && DB_PORT=5432

echo "→ Aguardando Postgres em ${DB_HOST}:${DB_PORT}..."
RETRIES=60
i=0
until nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge "$RETRIES" ]; then
    echo "✗ Postgres não respondeu em ${RETRIES}s. Abortando." >&2
    exit 1
  fi
  sleep 1
done
echo "  Postgres respondeu (após ${i}s)."

echo "→ Aplicando migrations..."
npx prisma migrate deploy

echo "→ Rodando seed (idempotente — admin é upserted)..."
npx tsx prisma/seed.ts || echo "⚠ Seed falhou ou já aplicado, seguindo..."

echo "→ Iniciando Next..."
exec node node_modules/.bin/next start -H 0.0.0.0 -p 3000
