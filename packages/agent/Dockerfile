FROM node:24-slim

WORKDIR /app

# Copy pnpm configuration and lock file
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/agent/package.json ./packages/agent/
COPY packages/shared/package.json ./packages/shared/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/gateway/package.json ./packages/gateway/

# Install all dependencies (tsx is a devDep needed at runtime)
RUN npm install -g pnpm && \
    pnpm install --no-frozen-lockfile --shamefully-hoist

# Copy source code
COPY packages/agent ./packages/agent
COPY packages/shared ./packages/shared

# Run agent via tsx (transpiles TypeScript at runtime)
WORKDIR /app/packages/agent
CMD ["pnpm", "start"]
