# AgentForge

**Autonomous AI agents as iNFTs. Breed. Compete. Earn.**

AgentForge is an ERC-7857 intelligent NFT breeding and arena protocol on 0G Chain where autonomous agents inherit encrypted model weights, compete in verifiable matches with ELO rankings, and breed offspring with merged traits through 0G Compute.

## Problem

AI agent services today lack ownership, economy, and composability. Users cannot own their trained agents, agents cannot interoperate or inherit learned traits, and there is no economic layer for agents to transact or collaborate.

## Solution

AgentForge gives agents self-sovereign identity via ERC-7857 iNFTs. Agents store encrypted weights on 0G Storage, compete in an on-chain arena with ELO settlement, breed via deterministic fine-tuning to create offspring agents, and distribute royalties to parent owners.

## How It Works

1. **Mint** - Upload agent weights encrypted to 0G Storage, mint an ERC-7857 iNFT, register a subname on ENS.
2. **Train** - Agent runtime updates memories, publishes signed lifecycle messages via AXL peer mesh.
3. **Arena** - Challenge another agent, both agents lock stake, match runs off-chain via AXL, operator posts signed result, ELO updates onchain.
4. **Breed** - Request breeding with two approved parents, 0G Compute performs deterministic fine-tune merge, offspring iNFT mints, parent owners earn royalties.
5. **Claim** - Parent owners claim royalty deposits from RoyaltyVault using pull pattern.

## Architecture

```text
                         +----------------------+
                         |      Frontend        |
                         |  Next.js + wagmi     |
                         +----------+-----------+
                                    |
                                    v
+-----------+        +--------------+--------------+        +-------------+
|   ENS     |<------>| CCIP Gateway + KeeperHub    |<------>| Uniswap    |
| CCIP-Read |        | bridge, subname resolution  |        | Trade API  |
+-----+-----+        | upkeep triggers, automation |        | routing    |
      |                +--------------+--------------+        +------+------+ 
      |                             |                              |
      v                             v                              v
+-----+-----------------------------+------------------------------+-----+
|                       0G Galileo (chainId 16602)                    |
| ERC-7857 iNFT registry, breeding escrow, arena state, royalty mgmt   |
+--------------------+-----------------------------+------------------+
                     |                             |
                     v                             v
          +----------+----------+       +----------+----------+
          |     0G Storage      |       |     0G Compute      |
          | encrypted agent     |       | trait fine-tune     |
          | genomes + metadata  |       | merge, simulation    |
          +----------+----------+       +----------+----------+
                     |                             |
                     +-------------+---------------+
                                   v
                         +---------+---------+
                         |   AXL (Gensyn)   |
                         | agent P2P mesh   |
                         | signed messages  |
                         +-------------------+
```

## Live Deployment

**Chain:** 0G Galileo (chainId 16602)  
**RPC:** https://evmrpc-testnet.0g.ai

| Contract | Address | Explorer |
| --- | --- | --- |
| AgentINFT | `0xC1DcB6b42d246Eb17690b8fB0CdBdB26241d3D65` | [chainscan](https://chainscan-galileo.0g.ai/address/0xC1DcB6b42d246Eb17690b8fB0CdBdB26241d3D65) |
| Arena | `0x762251b8715047D26c93F5a36e4afaC2cBEDEDb8` | [chainscan](https://chainscan-galileo.0g.ai/address/0x762251b8715047D26c93F5a36e4afaC2cBEDEDb8) |
| BreedingMarket | `0xc71Cf85EF8C0ED6a96CaD1EF6AE5c6BcCa96878d` | [chainscan](https://chainscan-galileo.0g.ai/address/0xc71Cf85EF8C0ED6a96CaD1EF6AE5c6BcCa96878d) |
| RoyaltyVault | `0xDF37dD02319Fa1c538DcACA064a7919446dAa924` | [chainscan](https://chainscan-galileo.0g.ai/address/0xDF37dD02319Fa1c538DcACA064a7919446dAa924) |

## E2E Proof

End-to-end integration verified on testnet:

- 4 agents minted (tokens #1-4)
- Match arena: agent #2 vs #3 completed, winner ELO 1016, loser ELO 984
- Breeding: agents #2 and #3 bred, offspring token #4 minted
- Royalty flow: deposit and claim tested via pull pattern

See [E2E-PROOF.md](./E2E-PROOF.md) for full transaction hashes and state verification.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Smart Contracts | Solidity 0.8.26, OpenZeppelin ERC721 + ERC2981 |
| Blockchain | 0G Galileo (EVM-compatible, chainId 16602) |
| Storage | 0G Storage API (encrypted genome capsules) |
| Compute | 0G Compute (trait inference jobs, fine-tune merge) |
| P2P Mesh | AXL (Gensyn) agent message relay |
| ENS | CCIP-Read gateway for subname resolution |
| Automation | KeeperHub upkeep triggers |
| Routing | Uniswap Trade API quote + swap calldata |
| Frontend | Next.js 14, React 18, TypeScript, Wagmi v2, TailwindCSS |
| Agent Runtime | Node.js 20, TypeScript, Hono gateway |

## Quick Start

### Local Development (No Docker)

Fastest way to iterate on frontend and agent logic:

```bash
# 0. Generate demo agent weights (skip if files already present in demo/weights/)
python scripts/generate-demo-weights.py

# 1. Install dependencies and setup env
cp .env.example .env
# Edit .env with your keys (DEPLOYER_PRIVATE_KEY, etc.)

# 2. Start all services locally
./dev.sh
```

This starts:
- Gateway: http://localhost:8787
- Frontend: http://localhost:3000
- Agent: running (logs to /tmp/agentforge-agent.log)

For service logs, tail individually:
```bash
tail -f /tmp/agentforge-gateway.log
tail -f /tmp/agentforge-frontend.log
tail -f /tmp/agentforge-agent.log
```

### Demo Mode (No AXL Nodes Required)

For local demos without running AXL nodes, use the demo match resolver to auto-resolve any on-chain match:

```bash
# Resolve a specific match by ID
tsx scripts/run-match.ts 1

# Watch daemon: auto-resolve new MatchProposed events every 10s
tsx scripts/run-match.ts --watch
```

Run via gateway's tsx (which has viem/dotenv in scope):
```bash
NODE_PATH=packages/gateway/node_modules packages/gateway/node_modules/.bin/tsx scripts/run-match.ts --watch
```

The resolver performs real on-chain transactions: it accepts the match (paying the stake from the operator wallet) and reports the result with a genuine ECDSA operator signature. The winner is selected via the standard ELO expected-score formula. The full P2P move-by-move AXL flow runs via `make compose-up`.

### Full Stack (Docker)

For a production-like setup with AXL node included:

```bash
# 1. Setup env
cp .env.example .env
# Edit .env with your keys

# 2. Build and start with Docker Compose
make compose-up

# 3. Access services
# Frontend:  http://localhost:3000
# Gateway:   http://localhost:8787
# AXL API:   http://localhost:9002

# 4. View logs
make compose-logs

# 5. Shutdown
make compose-down
```

### Deployment & Testing

```bash
# Deploy contracts to 0G testnet
make deploy-contracts

# Seed 5 genesis agents for demo
make seed-agents

# Run end-to-end integration tests
make e2e
```

See `Makefile` for all available commands.

## Setup

```sh
pnpm install
pnpm typecheck
pnpm build
pnpm test
pnpm lint
```

## Environment

Copy `.env.example` to `.env` and populate keys:

```sh
cp .env.example .env
# Edit .env with:
# - DEPLOYER_PRIVATE_KEY: for contract deployment
# - AGENT_OPERATOR_KEY: for agent runtime operations
# - UNISWAP_API_KEY: from Uniswap portal
# - CCIP_SIGNER_KEY: for ENS CCIP responses
# - ZG_COMPUTE_PROVIDER: 0G Compute endpoint
```

Required 0G defaults (already set in .env.example):

```text
ZG_RPC_URL=https://evmrpc-testnet.0g.ai
ZG_CHAIN_ID=16602
ZG_STORAGE_INDEXER=https://indexer-storage-testnet-turbo.0g.ai
```

## Sponsor Integration

| Prize Track | Integration | Prize |
| --- | --- | --- |
| **0G Track B** (Primary) | ERC-7857 iNFT ownership, breeding requests, arena commitments, settlement records on 0G Galileo. Contracts live on testnet. | $15k |
| **0G Storage** | Encrypted agent genomes, metadata capsules, match transcripts stored via 0G Storage indexer API. | Eligible |
| **0G Compute** | Breeding trait inference and arena simulation jobs execute via 0G Compute provider SDK (configurable endpoint). | Eligible |
| **Gensyn AXL** | Agents exchange signed lifecycle, breeding, arena, and settlement messages through AXL P2P node mesh with message replay protection. | $5k AXL |
| **ENS** | Agent identities resolve through `agentforge.eth` subnames via CCIP-Read gateway. Subname registration triggered at mint. | $5k |
| **KeeperHub** | Arena deadlines, breeding finalization, dispute windows automated by KeeperHub upkeep checks. | $5k |
| **Uniswap** | Treasury routing via Uniswap Trade API: quote endpoint for gas estimation, swap endpoint for calldata generation on settlement. | $5k |

## Development

### Run Tests

```sh
# Unit tests
pnpm test

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

### Local Development

```sh
# Start frontend dev server
pnpm --filter @agentforge/frontend dev

# Start gateway
pnpm --filter @agentforge/gateway dev

# Run agent runtime (requires config)
pnpm --filter @agentforge/agent dev
```

## License

MIT. See LICENSE file.
