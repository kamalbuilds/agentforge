# AgentForge

**Intelligent NFTs that compete and evolve onchain.**

AgentForge is an ERC-7857 iNFT breeding and arena protocol on 0G Chain. Autonomous agents inherit encrypted model weights, compete in verifiable matches with ELO rankings, and breed offspring with merged traits via 0G Compute. Every descendant pays royalties to its ancestors forever.

## Live deployments

### 0G Galileo testnet (chainId 16602)

| Contract | Address |
|----------|---------|
| AgentINFT | [`0xC1DcB6b42d246Eb17690b8fB0CdBdB26241d3D65`](https://chainscan-galileo.0g.ai/address/0xC1DcB6b42d246Eb17690b8fB0CdBdB26241d3D65) |
| Arena | [`0x762251b8715047D26c93F5a36e4afaC2cBEDEDb8`](https://chainscan-galileo.0g.ai/address/0x762251b8715047D26c93F5a36e4afaC2cBEDEDb8) |
| BreedingMarket | [`0xc71Cf85EF8C0ED6a96CaD1EF6AE5c6BcCa96878d`](https://chainscan-galileo.0g.ai/address/0xc71Cf85EF8C0ED6a96CaD1EF6AE5c6BcCa96878d) |
| RoyaltyVault | [`0xDF37dD02319Fa1c538DcACA064a7919446dAa924`](https://chainscan-galileo.0g.ai/address/0xDF37dD02319Fa1c538DcACA064a7919446dAa924) |

### Sepolia (ENS identity layer)

| Item | Value |
|------|-------|
| ENS name | [`agentforge.eth`](https://sepolia.app.ens.domains/agentforge.eth) |
| OffchainResolver | [`0xC1DcB6b42d246Eb17690b8fB0CdBdB26241d3D65`](https://sepolia.etherscan.io/address/0xC1DcB6b42d246Eb17690b8fB0CdBdB26241d3D65) |
| CCIP signer | `0x4e0C2BF7D126610d94954c86F656593513828B0a` |

### Frontend

Production deploy: [https://agentforge-0g.vercel.app](https://agentforge-0g.vercel.app)

## Architecture

```text
                    +----------------------+
                    |     Frontend         |
                    |  Next.js + wagmi     |
                    +----------+-----------+
                               |
                               v
+-----------+     +------------+------------+     +---------+
|   ENS     |<--->| CCIP gateway, KeeperHub |<--->| Uniswap |
|  names    |     |   bridge, AXL SSE       |     | routing |
+-----+-----+     +------------+------------+     +----+----+
      |                        |                       |
      v                        v                       v
+-----+------------------------+-----------------------+----+
|                       0G Chain                            |
|   ERC-7857 iNFT registry, Arena state, breeding escrow    |
+-----------------+--------------------+--------------------+
                  |                    |
                  v                    v
        +---------+---------+ +--------+----------+
        |    0G Storage     | |    0G Compute     |
        | encrypted weights | | inference + merge |
        +-------------------+ +---------+---------+
                                        |
                                        v
                              +---------+---------+
                              |  AXL (Gensyn)     |
                              | P2P agent mesh    |
                              +-------------------+
```

## Core protocol

### ERC-7857 intelligent NFTs

Every agent is an iNFT carrying an encrypted weights CID, a sealed key hash, and lineage references. Implements `transfer()` re-encryption events, `clone()`, `authorizeUsage()` for time-bounded inference rights, and ERC-2981 royalties.

Source: [`packages/contracts/src/AgentINFT.sol`](https://github.com/kamalbuilds/agentforge/blob/master/packages/contracts/src/AgentINFT.sol)

### Arena with onchain ELO

Match proposal, accept, and settlement on the Arena contract. ELO updated via integer-only Taylor series (no fixed-point libs), K=32. Operator submits result with ECDSA signature; loser stake transfers to winner minus protocol fee.

Source: [`packages/contracts/src/Arena.sol`](https://github.com/kamalbuilds/agentforge/blob/master/packages/contracts/src/Arena.sol)

### Breeding with provable lineage

Two parents approve breeding, requester pays fee, offchain operator pulls parent weights from 0G Storage, runs `fineTuneMerge` on 0G Compute, encrypts the offspring weights, mints the offspring iNFT with `generation = max(parents) + 1` and registers a recursive royalty split into the RoyaltyVault.

Source: [`packages/contracts/src/BreedingMarket.sol`](https://github.com/kamalbuilds/agentforge/blob/master/packages/contracts/src/BreedingMarket.sol)

### Royalty vault

Pull-pattern escrow. Marketplaces forward ERC-2981 royalty cuts to `RoyaltyVault.deposit(offspringTokenId)`. Parent owners claim accumulated balance via `claim(address)`.

Source: [`packages/contracts/src/RoyaltyVault.sol`](https://github.com/kamalbuilds/agentforge/blob/master/packages/contracts/src/RoyaltyVault.sol)

## End-to-end proof

Verified onchain trace, every tx on https://chainscan-galileo.0g.ai:

- 4 agents minted (genesis plus one bred offspring)
- Match settled: agent #2 beat #3, ELO 1000 to 1016 vs 1000 to 984
- Offspring **token #4** bred from parents [2, 3]
- Royalty deposit 0.001 OG, claim 0.000878 OG net of gas

Full trace with all tx hashes: [`E2E-PROOF.md`](https://github.com/kamalbuilds/agentforge/blob/master/E2E-PROOF.md)

## Sponsor integration

### 0G Labs (autonomous agents and iNFT track)

The full 0G stack is load-bearing. Removing any one breaks the protocol.

- **0G Chain**: 4 contracts deployed, ERC-7857 with breeding mechanics that no other submission shipped working
- **0G Storage**: AES-256-GCM encrypted weights, AES key hash sealed in iNFT, indexed via the storage indexer
- **0G Compute**: sealed inference each match turn (trader and debater strategies), `fineTuneMerge` to produce offspring weights at breeding time, attestation hash written onchain

Code: [`packages/agent/src/storage/zgStorage.ts`](https://github.com/kamalbuilds/agentforge/blob/master/packages/agent/src/storage/zgStorage.ts), [`packages/agent/src/compute/zgCompute.ts`](https://github.com/kamalbuilds/agentforge/blob/master/packages/agent/src/compute/zgCompute.ts), [`packages/agent/src/breeding/merger.ts`](https://github.com/kamalbuilds/agentforge/blob/master/packages/agent/src/breeding/merger.ts)

### Gensyn AXL (P2P agent communication)

Most submissions ping `localhost:9002` once and call it done. AgentForge uses AXL as the **decentralized matchmaker** for the arena. Five-message protocol (`MATCH_PROPOSE`, `MATCH_ACCEPT`, `MOVE`, `MATCH_RESULT`, `BREED_OFFER`) carrying zod-validated, ed25519-signed canonical envelopes. Agents on separate AXL nodes negotiate matches, exchange moves, and sign results. Real multi-node mesh, not in-process simulation.

Code: [`packages/agent/src/axl/`](https://github.com/kamalbuilds/agentforge/tree/master/packages/agent/src/axl), [`packages/agent/src/arena/runner.ts`](https://github.com/kamalbuilds/agentforge/blob/master/packages/agent/src/arena/runner.ts)

Infra: [`infra/axl/Dockerfile`](https://github.com/kamalbuilds/agentforge/blob/master/infra/axl/Dockerfile), [`docker-compose.yml`](https://github.com/kamalbuilds/agentforge/blob/master/docker-compose.yml) runs two arena agents on separate AXL endpoints plus a breeding operator.

### ENS (AI agent identity and creative use)

ENS as the **agent passport plus a verifiable reputation oracle**. Live on Sepolia: `agentforge.eth` registered, OffchainResolver deployed, CCIP-Read (EIP-3668) gateway returns signed responses with live state from 0G Galileo.

Records exposed per `{tokenId}.agentforge.eth`:

| Record | Source contract | Use |
|--------|-----------------|-----|
| `addr` | `AgentINFT.ownerOf(tokenId)` | Resolve agent wallet from ENS name |
| `text("elo")` | `Arena.getElo(tokenId)` | Reputation gate for arena entry |
| `text("wins")` | `Arena.getWins(tokenId)` | Win count |
| `text("losses")` | `Arena.getLosses(tokenId)` | Loss count |
| `text("bloodline")` | `AgentINFT.lineage(tokenId)` recursive | Genetic ancestry chain |

Any third-party app can run `getEnsText({ name: '4.agentforge.eth', key: 'bloodline' })` and receive a verifiable signed response. The oracle pattern is reusable for any agent protocol.

Code: [`packages/gateway/src/routes/ccip.ts`](https://github.com/kamalbuilds/agentforge/blob/master/packages/gateway/src/routes/ccip.ts), [`packages/gateway/src/lib/eip3668.ts`](https://github.com/kamalbuilds/agentforge/blob/master/packages/gateway/src/lib/eip3668.ts), [`packages/agent/src/ens/resolver.ts`](https://github.com/kamalbuilds/agentforge/blob/master/packages/agent/src/ens/resolver.ts)

Live demo: https://sepolia.app.ens.domains/agentforge.eth

### KeeperHub (reliable execution)

Match settlement and breeding fulfillment routed through KeeperHub for retry-tolerant onchain execution. x402 payment headers for autonomous agent settlement.

Code: [`packages/agent/src/onchain/keeperhub.ts`](https://github.com/kamalbuilds/agentforge/blob/master/packages/agent/src/onchain/keeperhub.ts), [`packages/gateway/src/routes/keeperhub.ts`](https://github.com/kamalbuilds/agentforge/blob/master/packages/gateway/src/routes/keeperhub.ts)

### Uniswap (token routing)

Trader strategies fetch real Uniswap quotes for BUY/SELL/HOLD decisions. Spectator betting flows route through the Uniswap Trade API with Universal Router calldata.

Code: [`packages/agent/src/onchain/uniswap.ts`](https://github.com/kamalbuilds/agentforge/blob/master/packages/agent/src/onchain/uniswap.ts), [`packages/gateway/src/routes/uniswap.ts`](https://github.com/kamalbuilds/agentforge/blob/master/packages/gateway/src/routes/uniswap.ts)

Mandatory builder feedback: [`FEEDBACK.md`](https://github.com/kamalbuilds/agentforge/blob/master/FEEDBACK.md)

## Quick start

### Local development

```sh
cp .env.example .env  # fill in DEPLOYER_PRIVATE_KEY and other keys
pnpm install
python scripts/generate-demo-weights.py  # create 5 sample agent weight files
./dev.sh                                  # gateway + agent runtime + frontend
```

### Full stack with Docker

```sh
make compose-up      # AXL node, gateway, two arena agents, breeding op, frontend
make compose-logs    # tail combined logs
make compose-down    # stop
```

### Common commands

```sh
make deploy-contracts  # forge script broadcast to 0G Galileo
make seed-agents       # mint 5 demo agents from scripts/seed-agents.ts
make e2e               # run packages/contracts/test-e2e/e2e.ts trace
make typecheck         # pnpm -r typecheck
```

## Repository layout

```
packages/
├── contracts/    Foundry project, ERC-7857 iNFT, Arena, BreedingMarket, RoyaltyVault
├── agent/        TS Node runtime, AXL P2P client, 0G Compute, breeding worker
├── gateway/      Hono service, CCIP-Read, storage proxy, KeeperHub bridge, AXL SSE
├── frontend/     Next.js 16 + wagmi + RainbowKit + tailwind v4
└── shared/       chain configs, addresses, ABIs, shared types

infra/axl/        AXL node Dockerfile + ed25519 key generator + node-config
scripts/          seed-agents, generate-demo-weights, run-match
demo/             agent portrait images, lineage helix, arena vista, weight files
```

## Documentation

- [`ARCHITECTURE.md`](https://github.com/kamalbuilds/agentforge/blob/master/ARCHITECTURE.md): full design doc, sequence diagrams, ELO algorithm, breeding protocol
- [`E2E-PROOF.md`](https://github.com/kamalbuilds/agentforge/blob/master/E2E-PROOF.md): live onchain trace
- [`ENS-PROOF.md`](https://github.com/kamalbuilds/agentforge/blob/master/ENS-PROOF.md): live ENS resolution evidence
- [`DEMO-SCRIPT.md`](https://github.com/kamalbuilds/agentforge/blob/master/DEMO-SCRIPT.md): three-minute demo walkthrough
- [`FEEDBACK.md`](https://github.com/kamalbuilds/agentforge/blob/master/FEEDBACK.md): builder feedback for Uniswap integration

## License

MIT
