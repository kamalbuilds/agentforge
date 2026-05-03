FROM node:24-slim AS builder

WORKDIR /app

# Copy pnpm configuration and lock file
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/shared/package.json ./packages/shared/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/agent/package.json ./packages/agent/
COPY packages/gateway/package.json ./packages/gateway/

# Install all dependencies (shamefully-hoist for Docker symlink compatibility)
RUN npm install -g pnpm && \
    pnpm install --no-frozen-lockfile --shamefully-hoist

# Copy source code
COPY packages/frontend ./packages/frontend
COPY packages/shared ./packages/shared

# Build shared package first (frontend depends on @agentforge/shared)
WORKDIR /app/packages/shared
RUN pnpm build

# Build Next.js with standalone output
WORKDIR /app/packages/frontend
RUN pnpm build

# Production runtime - use tiny standalone bundle
FROM node:24-slim

WORKDIR /app

# Copy only the standalone output (self-contained, no node_modules needed)
COPY --from=builder /app/packages/frontend/.next/standalone ./
COPY --from=builder /app/packages/frontend/.next/static ./packages/frontend/.next/static
COPY --from=builder /app/packages/frontend/public ./packages/frontend/public

EXPOSE 3000

ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Health check using node
HEALTHCHECK --interval=30s --timeout=15s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', r => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"

# Next.js standalone server
CMD ["node", "packages/frontend/server.js"]
