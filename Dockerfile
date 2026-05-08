# --- deps ---
FROM node:20-alpine AS deps
# vips: lib nativa usada pelo sharp (resize/conversão de imagens no upload)
RUN apk add --no-cache libc6-compat openssl vips-dev
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

# --- builder ---
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl vips-dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Vars são placeholder só para o build não falhar — substituídas em runtime.
ENV DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder"
ENV AUTH_SECRET="placeholder-replaced-at-runtime"
RUN npx prisma generate
RUN npm run build

# --- runner ---
FROM node:20-alpine AS runner
# - netcat-openbsd: probe Postgres no entrypoint (Swarm).
# - vips: runtime do sharp (uploads de imagem).
RUN apk add --no-cache libc6-compat openssl netcat-openbsd vips
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

# Diretório de uploads (montado como volume em produção via stack Swarm).
# Cria com permissões corretas pro usuário nextjs.
RUN mkdir -p /app/public/menu/uploads && \
    chown -R nextjs:nodejs /app/public/menu/uploads && \
    chmod +x ./scripts/docker-entrypoint.sh && \
    chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/bin/sh", "/app/scripts/docker-entrypoint.sh"]
