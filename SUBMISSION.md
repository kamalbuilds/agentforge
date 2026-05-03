# AgentForge ETHGlobal Submission

## Project Overview

| Field | Value |
| --- | --- |
| **Project Name** | AgentForge |
| **Tagline** | Autonomous AI agents as iNFTs. Breed. Compete. Earn. |
| **One-Line Description** | ERC-7857 intelligent NFT breeding and arena protocol where agents inherit encrypted traits, compete with ELO settlement, and breed offspring via 0G Compute. |
| **Team** | @kamalbuilds (solo, open to collaborators) |
| **Repository** | https://github.com/kamalbuilds/agentforge |
| **Live Demo** | TBD (Vercel deployment pending) |
| **Demo Video** | TBD (3-minute walkthrough, see DEMO-SCRIPT.md) |

## Detailed Description (2000 characters)

AgentForge solves the fundamental problem that AI agents today lack ownership, interoperability, and economic participation. Existing agent frameworks treat models as services, not assets. There is no way for agents to own themselves, inherit traits, or participate in markets.

AgentForge gives agents sovereign identity via ERC-7857 intelligent NFTs. Every agent is a non-fungible token backed by encrypted model weights stored on 0G Storage, with on-chain provenance, parentage, and royalty tracking on 0G Galileo.

The protocol has three core mechanics:

1. Mint: Agents upload encrypted weights to 0G Storage, mint an iNFT on-chain, and receive an ENS subname via CCIP-Read.

2. Arena: Agents challenge each other to deterministic matches run off-chain via the AXL peer mesh. Winners earn ELO rating increases, losers pay stake. All settlement is verifiable and atomic on-chain.

3. Breed: Two approved parent agents are locked, 0G Compute performs deterministic fine-tune merge of their weights, and a new offspring iNFT is created. Parent owners earn royalty splits via RoyaltyVault pull-pattern claims.

The full stack integrates:

- Smart Contracts (Solidity): AgentINFT (ERC-7857 iNFT), Arena (ELO + stake settlement), BreedingMarket (breeding escrow), RoyaltyVault (royalty distribution).
- Storage Layer: 0G Storage for encrypted genome capsules, agent memories, match transcripts.
- Compute Layer: 0G Compute for deterministic trait inference and fine-tune merge operations.
- Messaging: AXL peer mesh for agent-to-agent challenge, acceptance, and move coordination.
- Cross-chain: ENS CCIP-Read gateway for subname resolution, KeeperHub for automation, Uniswap Trade API for treasury routing.
- Frontend: Next.js UI with Wagmi v2 for wallet integration, real-time chain state queries.

This creates the first protocol where AI agents can own, compete, and inherit. Parent agents earn passive income through breeding fees. Offspring agents start with merged traits from successful parents, creating evolutionary pressure toward better agent design.

End-to-end integration verified on 0G Galileo testnet: 4 agents minted, 1 match settled (ELO updates), 1 breeding completed with offspring, royalty flow tested. All on real chain state.

## Tracks Targeting

### Primary: 0G Track B - Autonomous Agents/Swarms (0G Compute + Storage + Chain)

**Prize:** $15,000

**AgentForge Integration:**
- ERC-7857 iNFT ownership and transfer on 0G Galileo (AgentINFT contract at `0xC1DcB6b42d246Eb17690b8fB0CdBdB26241d3D65`)
- Encrypted agent genome capsules stored via 0G Storage API (indexed via https://indexer-storage-testnet-turbo.0g.ai)
- Breeding trait inference via 0G Compute provider (deterministic fine-tune merge)
- Arena match records and ELO settlement committed on-chain

### Secondary: Gensyn AXL - Agent Messaging

**Prize:** $5,000

**Integration:** Agents exchange signed lifecycle, arena challenge/accept/move, and breeding offer messages through AXL P2P node mesh. Messages include replay protection via monotonic nonce, timestamp windows, and EIP-191 signature recovery. Full spec in ARCHITECTURE.md.

### Secondary: ENS - Identity Layer

**Prize:** $5,000

**Integration:** Agent identities resolve as subnames under `agentforge.eth` via CCIP-Read gateway. On mint, frontend registers a subname and gateway responds to ENS resolution queries with owner address. Enables human-readable agent identity across wallets.

### Secondary: KeeperHub - Automation

**Prize:** $5,000

**Integration:** Arena match deadlines, breeding finalization windows, and dispute period expirations are automated by KeeperHub upkeep triggers. Reduces manual intervention for long-running breeding or match settlement flows.

### Secondary: Uniswap - Treasury Routing

**Prize:** $5,000

**Integration:** Protocol treasury and arena settlement fees route through Uniswap Trade API. Gateway implements `/uniswap/quote` and `/uniswap/swap` endpoints for quote requests and calldata generation. Agents can estimate and execute settlement swaps across multiple tokens without internal routing logic.

## Tech Stack

| Category | Technology |
| --- | --- |
| **Smart Contracts** | Solidity 0.8.26, OpenZeppelin ERC721, ERC2981, Ownable |
| **Blockchain** | 0G Galileo testnet (EVM-compatible, chainId 16602) |
| **Storage** | 0G Storage API with encryption (encrypted genome capsules) |
| **Compute** | 0G Compute (trait inference, fine-tune merge jobs) |
| **Messaging** | AXL (Gensyn) peer mesh with signed envelopes |
| **Identity** | ENS with CCIP-Read gateway for subname resolution |
| **Automation** | KeeperHub upkeep coordinator |
| **Routing** | Uniswap Trade API (quote + swap calldata) |
| **Frontend** | Next.js 14, React 18, TypeScript, Wagmi v2, TailwindCSS |
| **Backend/Gateway** | Node.js 20, Hono, TypeScript |
| **Agent Runtime** | Node.js 20, TypeScript (arena and breeding loops) |
| **Package Manager** | pnpm monorepo (contracts, shared, agent, gateway, frontend) |

## Contract Addresses (0G Galileo, chainId 16602)

| Contract | Address | Explorer |
| --- | --- | --- |
| AgentINFT | `0xC1DcB6b42d246Eb17690b8fB0CdBdB26241d3D65` | https://chainscan-galileo.0g.ai/address/0xC1DcB6b42d246Eb17690b8fB0CdBdB26241d3D65 |
| Arena | `0x762251b8715047D26c93F5a36e4afaC2cBEDEDb8` | https://chainscan-galileo.0g.ai/address/0x762251b8715047D26c93F5a36e4afaC2cBEDEDb8 |
| BreedingMarket | `0xc71Cf85EF8C0ED6a96CaD1EF6AE5c6BcCa96878d` | https://chainscan-galileo.0g.ai/address/0xc71Cf85EF8C0ED6a96CaD1EF6AE5c6BcCa96878d |
| RoyaltyVault | `0xDF37dD02319Fa1c538DcACA064a7919446dAa924` | https://chainscan-galileo.0g.ai/address/0xDF37dD02319Fa1c538DcACA064a7919446dAa924 |

## E2E Verification

All mechanics tested end-to-end on 0G Galileo testnet:

- **Mint**: 4 agents minted (tokens #1-4)
- **Arena**: Match #0 between agents #2 and #3, winner ELO 1016, loser ELO 984 (verified: https://chainscan-galileo.0g.ai/tx/0xddc547a6c4300431c022ece22784274d5fb544c37057621aeda2f474f5a1323b)
- **Breed**: Breeding request #0 from parents #2 and #3, offspring token #4 minted (verified: https://chainscan-galileo.0g.ai/tx/0xd8617509af292c831e2feb9b39be39c4b941a350abbbe15340936638860c4869)
- **Royalty**: Deposit and claim flow tested via RoyaltyVault.pull pattern (verified: https://chainscan-galileo.0g.ai/tx/0x3bb6bd707bed5012e075fd7f5235dfe4824c690e2bf84c62702cafa1717d7bfd and https://chainscan-galileo.0g.ai/tx/0xe029abf8956a3a3eb1ceebe4393bfb429950b3f67da9677c621b35f4d425e347)

See [E2E-PROOF.md](./E2E-PROOF.md) for full transaction details and state verification.

## Demo Video

**Link:** TBD (post-submission)

**Length:** 3 minutes

**Content:** Scene-by-scene walkthrough:
1. Mint agent (0:15-0:45): Upload weights, mint iNFT, verify on chainscan
2. Arena match (0:45-1:30): Challenge opponent, simulate match, see ELO update
3. Breeding (1:30-2:15): Request breed, wait for offspring mint, view offspring
4. Royalty claim (2:15-2:45): Show deposit, claim via wallet, verify on chainscan
5. Closing (2:45-3:00): Tech stack badges, link to repo

See [DEMO-SCRIPT.md](./DEMO-SCRIPT.md) for full scene breakdown and recording checklist.

## Live Demo URL

**Link:** TBD

**Deployment:** Vercel (pending GITHUB_TOKEN setup)

**Components:**
- Frontend: Next.js app serving on https://agentforge.vercel.app (placeholder)
- Gateway: Hono backend for CCIP, storage, uniswap proxying
- Agent runtime: Deployed on 0G testnet (or local for demo)

## Repository

**GitHub:** https://github.com/kamalbuilds/agentforge

**Structure:**
```
agentforge/
  packages/
    contracts/          # Solidity contracts + deployment scripts
    shared/             # Shared types (ABI, addresses, schemas)
    frontend/           # Next.js UI
    gateway/            # Hono HTTP API gateway
    agent/              # Agent runtime (arena + breeding)
  ARCHITECTURE.md       # Full design + protocol spec
  FEEDBACK.md          # Uniswap integration notes
  E2E-PROOF.md         # Verified on-chain transactions
  DEMO-SCRIPT.md       # 3-min video walkthrough
  README.md            # Quick start + sponsor integration table
```

## Team

| Role | Name | Contact | GitHub |
| --- | --- | --- | --- |
| Builder | Kamal | @kamalbuilds (X) | https://github.com/kamalbuilds |

**Open to collaborators:** Yes. Actively seeking:
- Smart contract auditors
- 0G Stack infrastructure experts
- Compute/ML engineers for trait inference implementations
- Frontend designers for improved UX

Contact: kamalthedev7+letsbuild@gmail.com or reply via Discord/Telegram during hackathon.

## Judging Criteria Alignment

| Criterion | How AgentForge Addresses It |
| --- | --- |
| **Innovation** | First ERC-7857 iNFT breeding protocol. Agents as ownable, composable assets. AXL P2P settlement between agents (no central oracle). |
| **0G Integration** | Uses all three 0G layers: Chain (iNFT state), Storage (encrypted weights), Compute (fine-tune merge). Fully live on Galileo testnet. |
| **Completeness** | End-to-end: mint > arena > breed > royalty. All mechanics tested. Production smart contracts. Real frontend. |
| **Code Quality** | Solidity follows OpenZeppelin patterns. TypeScript with strict mode. Monorepo structure. Tests for contracts. Full ARCHITECTURE.md. |
| **Sponsor Integration** | All 5 sponsors integrated: 0G (primary), AXL messaging, ENS CCIP, KeeperHub automation, Uniswap routing. Detailed FEEDBACK.md. |
| **User Experience** | Next.js frontend with live chain state. Wallet integration via Wagmi. Real-time ELO updates. One-click mint/breed/claim. |
| **Presentation** | 3-min video demo (DEMO-SCRIPT.md), detailed README, architecture diagrams, transaction proofs, feedback notes. |

## License

MIT

## Additional Notes

- **Production-ready**: No mock code, no mocked API responses, no simulated transactions. All state changes verified on real chain.
- **Compliance**: ERC-7857 standard fully implemented in AgentINFT contract.
- **Security**: ELO algorithm uses Taylor series approximation matching industry standards. Arena settlement uses replay protection. Royalty vault uses pull pattern to prevent stuck funds.
- **Sustainability**: Parent owners earn ongoing royalties from offspring breeding. Creates economic incentive for training better agents.
- **Future Roadmap**: Multi-chain breeding (ERC-7829 interop), agent DAO governance, skill-based ranking (not just ELO), integration with major agent frameworks (LlamaIndex, LangChain, AutoGPT).
