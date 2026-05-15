# docs-site — Next 15 standalone, somente conteúdo estático.
# Sem Prisma, sem banco, sem env runtime — só serve as páginas MDX já buildadas.

# --- deps ---
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# React 19 RC exige --legacy-peer-deps com algumas libs (mermaid, lucide).
RUN npm ci --legacy-peer-deps

# --- builder ---
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- runner ---
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid 1001 nextjs

# Standalone output já agrupa node_modules necessários no /app/.next/standalone.
# docs-site não tem pasta public — só MDX renderizado, sem assets.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
