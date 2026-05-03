#!/usr/bin/env bash
#
# Dev Orchestration Script for AgentForge
# Starts all services in background (no Docker), fast local iteration
# Usage: ./dev.sh
# Ctrl-C to stop all services
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directories
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="/tmp"
AGENT_LOG="$LOG_DIR/agentforge-agent.log"
GATEWAY_LOG="$LOG_DIR/agentforge-gateway.log"
FRONTEND_LOG="$LOG_DIR/agentforge-frontend.log"
AXL_LOG="$LOG_DIR/agentforge-axl.log"

# PIDs
declare -a PIDS=()

# Cleanup on exit
cleanup() {
  echo -e "\n${YELLOW}Shutting down services...${NC}"
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      echo -e "${BLUE}Terminating PID $pid${NC}"
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait "${PIDS[@]}" 2>/dev/null || true
  echo -e "${GREEN}All services stopped${NC}"
}

trap cleanup SIGINT SIGTERM EXIT

# Start function
start_service() {
  local service_name=$1
  local command=$2
  local log_file=$3
  local port=$4

  echo -e "${BLUE}Starting $service_name...${NC}"

  # Check if port is already in use
  if [ -n "$port" ] && lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${RED}ERROR: Port $port is already in use (possibly $service_name)${NC}"
    return 1
  fi

  # Start service in background with log file
  eval "$command" > "$log_file" 2>&1 &
  local pid=$!
  PIDS+=("$pid")

  echo -e "${GREEN}$service_name started (PID: $pid, log: $log_file)${NC}"
}

# Check prerequisites
check_prerequisites() {
  echo -e "${BLUE}Checking prerequisites...${NC}"

  if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}ERROR: pnpm not found. Install with: npm install -g pnpm${NC}"
    exit 1
  fi

  if ! command -v node &> /dev/null; then
    echo -e "${RED}ERROR: Node.js not found${NC}"
    exit 1
  fi

  echo -e "${GREEN}Prerequisites OK${NC}"
}

# Main
main() {
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}  AgentForge Dev Orchestration${NC}"
  echo -e "${BLUE}========================================${NC}"

  # Check env
  if [ ! -f "$PROJECT_ROOT/.env" ]; then
    echo -e "${YELLOW}WARNING: .env file not found. Copying from .env.example${NC}"
    cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
    echo -e "${YELLOW}Please fill in your keys in .env file${NC}"
  fi

  check_prerequisites

  cd "$PROJECT_ROOT"

  echo -e "${BLUE}Installing dependencies...${NC}"
  pnpm install --frozen-lockfile 2>&1 | tail -5

  # Clear old logs
  > "$AGENT_LOG"
  > "$GATEWAY_LOG"
  > "$FRONTEND_LOG"
  > "$AXL_LOG"

  # Start services
  echo -e "\n${BLUE}Starting services...${NC}"

  # AXL Node (optional, warn if not installed)
  if command -v axl-node &> /dev/null; then
    start_service "AXL Node" \
      "axl-node -config $PROJECT_ROOT/infra/axl/node-config.json" \
      "$AXL_LOG" \
      "9002"
  else
    echo -e "${YELLOW}AXL Node not installed locally. Skipping (use docker-compose for full stack)${NC}"
  fi

  # Gateway (runs from packages/gateway)
  start_service "Gateway" \
    "cd $PROJECT_ROOT/packages/gateway && pnpm dev" \
    "$GATEWAY_LOG" \
    "8787"

  # Agent (arena runner)
  start_service "Agent (Arena)" \
    "cd $PROJECT_ROOT/packages/agent && STRATEGY=trader AGENT_TOKEN_ID=2 pnpm dev" \
    "$AGENT_LOG" \
    ""

  # Frontend
  start_service "Frontend" \
    "cd $PROJECT_ROOT/packages/frontend && pnpm dev" \
    "$FRONTEND_LOG" \
    "3000"

  # Print startup summary
  echo -e "\n${GREEN}========================================${NC}"
  echo -e "${GREEN}  AgentForge dev environment running${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo -e "${BLUE}Services:${NC}"
  echo -e "  ${GREEN}Gateway${NC}:    http://localhost:8787"
  echo -e "  ${GREEN}Frontend${NC}:   http://localhost:3000"
  echo -e "  ${GREEN}Agent${NC}:      Running (logs: $AGENT_LOG)"
  [ -f "$AXL_LOG" ] && [ -s "$AXL_LOG" ] && echo -e "  ${GREEN}AXL Node${NC}:   http://localhost:9002"

  echo -e "\n${BLUE}Logs:${NC}"
  echo -e "  Gateway:  ${GATEWAY_LOG}"
  echo -e "  Frontend: ${FRONTEND_LOG}"
  echo -e "  Agent:    ${AGENT_LOG}"
  [ -f "$AXL_LOG" ] && echo -e "  AXL:      ${AXL_LOG}"

  echo -e "\n${BLUE}Commands:${NC}"
  echo -e "  tail -f $GATEWAY_LOG   # Watch gateway logs"
  echo -e "  tail -f $FRONTEND_LOG  # Watch frontend logs"
  echo -e "  tail -f $AGENT_LOG     # Watch agent logs"

  echo -e "\n${YELLOW}Press Ctrl-C to stop all services${NC}\n"

  # Wait for all background processes
  wait
}

main "$@"
