.PHONY: help dev compose-up compose-logs compose-down deploy-contracts seed-agents e2e typecheck build clean

# Colors
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m # No Color

help:
	@echo "$(BLUE)AgentForge Development Commands$(NC)"
	@echo ""
	@echo "$(GREEN)Local Development (no Docker):$(NC)"
	@echo "  make dev              - Start all services locally (fast iteration)"
	@echo ""
	@echo "$(GREEN)Docker Compose (full stack):$(NC)"
	@echo "  make compose-up       - Build and start all services in Docker"
	@echo "  make compose-logs     - Tail Docker container logs"
	@echo "  make compose-down     - Stop and remove all containers"
	@echo ""
	@echo "$(GREEN)Smart Contracts:$(NC)"
	@echo "  make deploy-contracts - Deploy contracts to 0G testnet"
	@echo "  make seed-agents      - Mint 5 genesis agents (requires contracts deployed)"
	@echo "  make e2e              - Run end-to-end integration tests"
	@echo ""
	@echo "$(GREEN)Development:$(NC)"
	@echo "  make typecheck        - Type-check all packages"
	@echo "  make build            - Build all packages"
	@echo "  make clean            - Remove build artifacts and node_modules"
	@echo "  make test             - Run all tests"
	@echo "  make lint             - Lint all packages"
	@echo ""

# Local development (no Docker)
dev:
	@chmod +x dev.sh
	@./dev.sh

# Docker Compose
compose-up:
	@echo "$(BLUE)Building and starting Docker services...$(NC)"
	@docker compose up -d --build
	@sleep 2
	@echo "$(GREEN)All services started!$(NC)"
	@echo "Frontend:  http://localhost:3000"
	@echo "Gateway:   http://localhost:8787"
	@echo "AXL API:   http://localhost:9002"

compose-logs:
	@docker compose logs -f --tail=50

compose-down:
	@echo "$(YELLOW)Stopping Docker services...$(NC)"
	@docker compose down
	@echo "$(GREEN)Services stopped$(NC)"

compose-clean:
	@echo "$(YELLOW)Removing containers and volumes...$(NC)"
	@docker compose down -v
	@echo "$(GREEN)Cleaned up$(NC)"

# Smart Contracts
deploy-contracts:
	@echo "$(BLUE)Deploying contracts to 0G testnet...$(NC)"
	@cd packages/contracts && forge script script/Deploy.s.sol:Deploy --rpc-url $(ZG_RPC_URL) --broadcast
	@echo "$(GREEN)Contracts deployed!$(NC)"

seed-agents:
	@echo "$(BLUE)Seeding genesis agents...$(NC)"
	@cd . && npx tsx scripts/seed-agents.ts
	@echo "$(GREEN)Genesis agents minted!$(NC)"

e2e:
	@echo "$(BLUE)Running end-to-end tests...$(NC)"
	@cd packages/contracts && npx tsx test-e2e/e2e.ts
	@echo "$(GREEN)E2E tests passed!$(NC)"

# Development
typecheck:
	@echo "$(BLUE)Type-checking all packages...$(NC)"
	@pnpm -r typecheck
	@echo "$(GREEN)All packages type-check OK$(NC)"

build:
	@echo "$(BLUE)Building all packages...$(NC)"
	@pnpm -r build
	@echo "$(GREEN)Build complete!$(NC)"

test:
	@echo "$(BLUE)Running tests...$(NC)"
	@pnpm -r test
	@echo "$(GREEN)Tests complete!$(NC)"

lint:
	@echo "$(BLUE)Linting all packages...$(NC)"
	@pnpm -r lint
	@echo "$(GREEN)Lint complete!$(NC)"

clean:
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	@rm -rf node_modules
	@pnpm -r exec rm -rf node_modules dist out .next build cache
	@echo "$(GREEN)Clean complete!$(NC)"

# Utilities
.DEFAULT_GOAL := help
