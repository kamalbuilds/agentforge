# AgentForge Gateway Service

Production Hono gateway for AgentForge, providing real integrations with ENS, 0G Storage, KeeperHub, Uniswap, and AXL consensus layer.

## Architecture

Built with:
- **Framework:** Hono 4.9.7 (lightweight HTTP framework)
- **Runtime:** Node.js 24 with TypeScript 5.6
- **Auth/Signing:** ethers.js v6 (CCIP signing)
- **On-chain:** viem (RPC calls)
- **Storage:** 0G Storage (encrypted model weights)
- **Proxies:** KeeperHub, Uniswap, AXL

## Routes

### 1. CCIP-Read Gateway (ENS subnames)
**Endpoint:** `POST /ccip/lookup`

EIP-3668 compliant CCIP-Read gateway for resolving `{tokenId}.agentforge.eth` subnames and text records.

**Request:**
```json
{
  "sender": "0x...",
  "data": "0x..."
}
```

**Response:**
```json
{
  "data": "0x...",
  "expires": 1234567890,
  "signature": "0x..."
}
```

Supports:
- `addr(bytes32 node)` → returns AgentINFT owner
- `text(node, "elo")` → returns Arena ELO rating
- `text(node, "wins")`, `"losses"`, `"bloodline")` → returns arena stats

### 2. 0G Storage Upload Proxy
**Endpoint:** `POST /storage/upload`

Upload encrypted model weights to 0G Storage via indexer.

**Request:**
```json
{
  "buffer": "base64-encoded-encrypted-buffer",
  "metadata": { "name": "agent-v1" }
}
```

**Response:**
```json
{
  "cid": "Qm...",
  "txHash": null
}
```

### 3. 0G Storage Download Proxy
**Endpoint:** `GET /storage/:cid`

Retrieve encrypted data from 0G Storage.

**Response:**
```json
{
  "data": "base64-encoded-buffer"
}
```

### 4. KeeperHub Bridge
**Endpoint:** `POST /keeperhub/execute`

Forward transaction execution to KeeperHub with automatic API key authentication.

**Request:**
```json
{
  "to": "0x...",
  "data": "0x...",
  "value": "0",
  "chainId": 16601
}
```

**Status Check:**
`GET /keeperhub/status/:jobId`

Returns KeeperHub job status directly.

### 5. Uniswap Quote Proxy
**Endpoint:** `GET /uniswap/quote`

Proxy Uniswap trade API for real-time quotes.

**Query params:**
```
tokenIn=0x...&tokenOut=0x...&amount=1000000000000000000&chainId=11155111
```

**Swap Execution:**
`POST /uniswap/swap` - Forward swap transactions to Uniswap.

### 6. AXL Consensus Bridge
**Endpoint:** `GET /arena/stream` (Server-Sent Events)

SSE stream for real-time arena match events from AXL node.

**Propose Match:**
`POST /arena/propose`

```json
{
  "fromAgent": "123",
  "toAgent": "456",
  "stake": "1000000000000000000"
}
```

**Get Peers:**
`GET /arena/peers` - Fetch connected peer topology.

### 7. Health Check
**Endpoint:** `GET /health`

```json
{
  "ok": true,
  "timestamp": "2026-05-02T20:12:27.899Z"
}
```

## Environment Configuration

Create `.env` file (see `.env.example`):

```env
PORT=8787
NODE_ENV=development
LOG_LEVEL=info

# Required for CCIP signing (32-byte private key, NO 0x prefix in env)
CCIP_SIGNER_KEY=0x0000000000000000000000000000000000000000000000000000000000000001

# 0G Storage indexer
ZEROG_INDEXER_URL=http://localhost:6000

# KeeperHub
KEEPERHUB_API_KEY=your_api_key
KEEPERHUB_BASE_URL=https://api.keeperhub.com

# Uniswap (optional)
UNISWAP_API_KEY=your_api_key
UNISWAP_BASE_URL=https://trade-api.gateway.uniswap.org

# AXL node
AXL_NODE_URL=http://localhost:5000

# RPC endpoints
RPC_URL_0G=https://evmrpc-testnet.0g.ai
RPC_URL_SEPOLIA=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
```

## Development

```bash
# Install dependencies
pnpm install

# Type check
pnpm typecheck

# Build
pnpm build

# Dev server with auto-reload
pnpm dev

# Start production server
pnpm start
```

## Real Integrations

All endpoints make real API calls to actual services:

- **On-chain:** viem reads directly from 0G Galileo RPC
- **CCIP:** Real ethers.js signatures for EIP-3668
- **Storage:** Real 0G Storage indexer HTTP calls
- **KeeperHub:** Real API requests with auth headers
- **Uniswap:** Real proxied requests to trade API
- **AXL:** Real long-poll streams from AXL node

## Error Handling

All endpoints return appropriate HTTP status codes:
- `400` - Invalid request parameters
- `401` - Missing or invalid credentials
- `404` - Not found (CCIP signature invalid, resource missing, endpoint 404 from upstream)
- `500` - Server error (RPC failure, service unavailable, etc.)

Error responses include descriptive messages:
```json
{
  "error": "Failed to upload to storage: network error"
}
```

## Contract ABIs

AgentINFT and ArenaHub ABIs are pre-defined in `src/onchain/abis.ts` with core functions:

- `ownerOf(tokenId)` - Get token owner (for CCIP addr resolver)
- `getTokenData(tokenId)` - Get weights CID, parents, generation
- `generation(tokenId)` - Get breeding generation
- `getElo(tokenId)` - Get ELO rating
- `getWins/getLosses(tokenId)` - Get match record
- `getBloodline(tokenId)` - Get agent bloodline string

## CORS

Gateway is configured for open CORS to allow frontend requests:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

## Testing

TypeScript compilation and routing tested via:
- `pnpm typecheck` - Catches all type errors
- `pnpm build` - Compiles to ES modules
- Integration tests in `test/` (barebones, production would expand)

Verify by starting server and testing endpoints:
```bash
pnpm dev &
curl http://localhost:8787/health
curl "http://localhost:8787/uniswap/quote?tokenIn=0x...&tokenOut=0x...&amount=...&chainId=..."
```

## Production Deployment

1. Build: `pnpm build`
2. Set env vars in production environment
3. Start: `pnpm start` or `node dist/index.js`
4. Listen on `0.0.0.0:${PORT}`

For Railway/Vercel, add `pnpm build && pnpm start` as build command.
