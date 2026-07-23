# syntax=docker/dockerfile:1.7
# Multi-stage build for Next.js standalone output.
# Assumes `output: "standalone"` in next.config.ts.

# ─── deps ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
# Use npm to install pnpm — avoids corepack network calls that timeout in CI/VPS.
RUN npm install -g pnpm@11.15.1 --prefer-offline || npm install -g pnpm@11.15.1
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
COPY package.json pnpm-lock.yaml .npmrc pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

# ─── cli ─────────────────────────────────────────────────────────────────
# Used by the `tools` compose service for migrations, seed, admin-create.
# Has pnpm + tsx + drizzle-kit. Does NOT run next build.
FROM node:22-alpine AS cli
WORKDIR /app
RUN npm install -g pnpm@11.15.1 --prefer-offline || npm install -g pnpm@11.15.1
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ─── builder ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@11.15.1 --prefer-offline || npm install -g pnpm@11.15.1
ENV NEXT_TELEMETRY_DISABLED=1
# Placeholder values so Next.js SSG does not hang waiting for a real DB.
# Real values are injected at container start via docker-compose / env file.
ENV DATABASE_URL=postgresql://build-placeholder:x@localhost:5432/none
ENV AUTH_SECRET=build-placeholder-replace-at-runtime
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public && pnpm build

# ─── runner ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]
