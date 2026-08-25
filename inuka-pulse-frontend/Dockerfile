# ── Stage 1: dependencies ────────────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

# Enable corepack so pnpm@9.15.0 (pinned in package.json) is used exactly
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy manifests first — Docker caches this layer until they change
COPY package.json pnpm-lock.yaml* ./

# Install production + dev deps (dev needed for the build step)
RUN pnpm install --frozen-lockfile

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are baked into the JS bundle at build time.
# Pass the backend URL as a build arg so it ends up in the bundle.
# Override with: docker build --build-arg NEXT_PUBLIC_INUKA_API_URL=https://...
ARG NEXT_PUBLIC_INUKA_API_URL=http://localhost:8080
ENV NEXT_PUBLIC_INUKA_API_URL=${NEXT_PUBLIC_INUKA_API_URL}

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm run build

# ── Stage 3: runtime ──────────────────────────────────────────────────────────
# Uses Next.js standalone output — no node_modules needed, image is ~200MB
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy only what the standalone server needs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
