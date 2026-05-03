FROM node:24-slim

WORKDIR /app

# Copy pnpm configuration and lock file
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/agent/package.json ./packages/agent/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies (production only)
RUN npm install -g pnpm && \
    pnpm install --prod --frozen-lockfile

# Copy source code
COPY packages/agent ./packages/agent
COPY packages/shared ./packages/shared

# Build the agent
WORKDIR /app/packages/agent
RUN pnpm build 2>/dev/null || true

# Run agent
CMD ["pnpm", "start"]
