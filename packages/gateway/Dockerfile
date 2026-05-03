FROM node:24-slim

WORKDIR /app

# Copy pnpm configuration and lock file
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/gateway/package.json ./packages/gateway/
COPY packages/shared/package.json ./packages/shared/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/agent/package.json ./packages/agent/

# Install all dependencies (including devDeps for build step)
RUN npm install -g pnpm && \
    pnpm install --no-frozen-lockfile --shamefully-hoist

# Copy source code
COPY packages/gateway ./packages/gateway
COPY packages/shared ./packages/shared

# Build gateway
WORKDIR /app/packages/gateway
RUN pnpm build

# Expose API port
EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8787/health || exit 1

# Run gateway
CMD ["pnpm", "start"]
