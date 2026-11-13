# ==============================================================================
# ALGIONS Pharmacy Cloud REST API - Production Dockerfile
# ==============================================================================

FROM node:22-alpine AS builder

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

# Copy workspace config and package manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/domain/package.json ./packages/domain/
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/

# Install workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy source trees
COPY packages/contracts ./packages/contracts
COPY packages/domain ./packages/domain
COPY packages/db ./packages/db
COPY apps/api ./apps/api

# Build backend and its dependencies
RUN pnpm --filter @algions/api... build

# Prune devDependencies for a lean production runtime
RUN pnpm --filter @algions/api --prod deploy pruned-app 2>/dev/null || true

# Production runner stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Copy compiled artifacts & node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/contracts ./packages/contracts
COPY --from=builder /app/packages/domain ./packages/domain
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/apps/api ./apps/api

EXPOSE 3001

CMD ["node", "apps/api/dist/server.js"]
