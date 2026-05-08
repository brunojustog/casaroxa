#!/bin/sh
# Entrypoint do container de produção.
# Roda migrations e seed (idempotente) antes de subir o Next.

set -e

echo "→ Aplicando migrations..."
npx prisma migrate deploy

echo "→ Rodando seed (idempotente — admin é upserted)..."
npx tsx prisma/seed.ts || echo "⚠ Seed falhou ou já aplicado, seguindo..."

echo "→ Iniciando Next..."
exec node node_modules/.bin/next start -H 0.0.0.0 -p 3000
