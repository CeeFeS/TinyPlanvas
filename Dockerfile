# TinyPlanvas Frontend Dockerfile
# ================================
# Multi-stage build for optimized production image.
# Uses Debian slim (not Alpine): npm on Alpine frequently crashes with
# "Exit handler never called!" leaving an empty node_modules, so `next` is missing.

# Stage 1: Dependencies
FROM node:20-bookworm-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./

# Prefer IPv4 + fewer parallel sockets: Docker bridge networking frequently
# fails npm fetches with ETIMEDOUT/EHOSTUNREACH, after which npm 10 can exit 0
# with "Exit handler never called!" and an empty node_modules.
# Also require Next.js to exist so a silent npm failure cannot continue the build.
ENV NODE_OPTIONS=--dns-result-order=ipv4first
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
RUN npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set maxsockets 3 \
    && (npm ci --omit=dev --no-audit --no-fund \
        || (echo "npm ci failed, retrying…" && rm -rf node_modules && npm ci --omit=dev --no-audit --no-fund)) \
    && test -f node_modules/next/package.json \
    && test -e node_modules/.bin/next

# Stage 2: Builder
FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# IMPORTANT: NEXT_PUBLIC_POCKETBASE_URL must be empty for Docker deployment!
# Browser uses window.location.origin (same origin via nginx reverse proxy).
ARG NEXT_PUBLIC_POCKETBASE_URL=
ENV NEXT_PUBLIC_POCKETBASE_URL=$NEXT_PUBLIC_POCKETBASE_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Fonts are self-hosted (next/font/local); no Google Fonts network at build time.
# Quiet npm's "new major version" notice in build logs.
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

RUN npm run build

# Stage 3: Runner
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
