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

# Copy contract artifacts (agent loads ABIs from contracts/out at runtime)
COPY packages/contracts/out ./packages/contracts/out

# Build shared package (agent imports @agentforge/shared at runtime)
WORKDIR /app/packages/shared
RUN pnpm build

# Run agent via tsx with --import flag (Node.js 24 compatible)
WORKDIR /app/packages/agent
CMD ["node", "--import", "tsx/esm", "src/index.ts"]
