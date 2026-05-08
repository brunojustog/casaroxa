# --- deps ---
# node:20-slim (Debian) — sharp tem prebuilds nativos pra glibc, instala sem compilar.
FROM node:20-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

# --- builder ---
FROM node:20-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
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
FROM node:20-slim AS runner
# - netcat-openbsd: probe Postgres no entrypoint (Swarm).
# - openssl/ca-certificates: TLS pra Prisma + Anthropic.
# (sharp/libvips vem nos prebuilds binários — sem pacote de sistema.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

# Diretório de uploads (montado como volume em produção via stack Swarm).
RUN mkdir -p /app/public/menu/uploads && \
    chown -R nextjs:nodejs /app/public/menu/uploads && \
    chmod +x ./scripts/docker-entrypoint.sh && \
    chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/bin/sh", "/app/scripts/docker-entrypoint.sh"]
