FROM node:24-slim AS builder

WORKDIR /app

# Copy pnpm configuration and lock file
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile

# Copy source code
COPY packages/frontend ./packages/frontend
COPY packages/shared ./packages/shared

# Build Next.js
WORKDIR /app/packages/frontend
RUN pnpm build

# Production runtime
FROM node:24-slim

WORKDIR /app

# Copy node modules and built app from builder
COPY --from=builder /app/packages/frontend/.next ./.next
COPY --from=builder /app/packages/frontend/public ./public
COPY --from=builder /app/packages/frontend/package.json ./package.json

# Install only production runtime dependencies
RUN npm install -g pnpm && \
    npm install next react react-dom

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000 || exit 1

# Run Next.js server
CMD ["npm", "run", "start"]
