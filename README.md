# AgentForge

AgentForge is an ERC-7857 iNFT breeding and arena protocol on 0G Chain where autonomous agents inherit encrypted traits, compete, and evolve through verifiable off-chain compute.

```text
                         +----------------------+
                         |      Frontend        |
                         |  Next.js + wagmi     |
                         +----------+-----------+
                                    |
                                    v
+-----------+        +--------------+--------------+        +-------------+
|   ENS     |<------>| CCIP Gateway + KeeperHub    |<------>| Uniswap    |
| names     |        | bridge and upkeep triggers  |        | routing    |
+-----+-----+        +--------------+--------------+        +------+------+ 
      |                             |                              |
      v                             v                              v
+-----+-----------------------------+------------------------------+-----+
|                           0G Chain                                  |
| ERC-7857 iNFT registry, breeding escrow, arena state, settlement     |
+--------------------+-----------------------------+------------------+
                     |                             |
                     v                             v
          +----------+----------+       +----------+----------+
          |     0G Storage      |       |     0G Compute      |
          | encrypted genomes   |       | trait inference     |
          +----------+----------+       +----------+----------+
                     |                             |
                     +-------------+---------------+
                                   v
                         +---------+---------+
                         |   AXL (Gensyn)   |
                         | agent messages   |
                         +-------------------+
```

## Prize Mapping

| Prize track | AgentForge integration |
| --- | --- |
| 0G Chain | ERC-7857 iNFT ownership, breeding requests, arena commitments, and settlement records run on 0G Galileo testnet. |
| 0G Storage | Encrypted agent genomes, metadata capsules, and match transcripts are stored through the 0G storage indexer. |
| 0G Compute | Breeding trait inference and arena simulation jobs execute against configurable 0G compute providers. |
| Gensyn AXL | Agents exchange signed lifecycle, breeding, and arena messages through the AXL node mesh. |
| ENS | Agent identities resolve through `agentforge.eth` subnames with CCIP-Read gateway responses. |
| KeeperHub | Arena deadlines, breeding finalization, and dispute windows are automated by KeeperHub triggers. |
| Uniswap | Entry fees, rewards, and treasury operations can quote and route swaps through the Uniswap Trade API. |

## Setup

```sh
pnpm install
pnpm typecheck
pnpm build
pnpm test
pnpm lint
```

## Environment

Copy `.env.example` to `.env` and provide keys for deployers, agent operators, ENS CCIP signing, KeeperHub, Uniswap, Sepolia RPC, and the selected 0G Compute provider.

Required 0G defaults are:

```text
ZG_RPC_URL=https://evmrpc-testnet.0g.ai
ZG_CHAIN_ID=16601
ZG_STORAGE_INDEXER=https://indexer-storage-testnet-turbo.0g.ai
```
