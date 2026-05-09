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
# ARG (em vez de ENV) para não persistir "secrets" no metadata da imagem.
# São placeholders só para o `next build` não falhar — substituídos em runtime.
ARG DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder"
ARG AUTH_SECRET="placeholder-replaced-at-runtime"
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

# COPY com --chown ja seta dono na própria layer — muito mais rápido que `chown -R` depois.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

# Cria diretório de uploads com permissão correta + chmod no entrypoint.
RUN mkdir -p /app/public/menu/uploads && \
    chown nextjs:nodejs /app/public/menu/uploads && \
    chmod +x /app/scripts/docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/bin/sh", "/app/scripts/docker-entrypoint.sh"]
