/**
 * match-resolver.ts
 *
 * Shared helper that accepts + resolves a pending Arena match on-chain.
 * Used by both the gateway endpoint and the standalone CLI script.
 *
 * Resolution flow:
 *   1. Read match state from Arena contract.
 *   2. If status == Proposed: call acceptMatch() payable with matching stake.
 *   3. Read ELO of both agents, compute ELO-weighted winner.
 *   4. Build resultHash = keccak256(abi.encodePacked(matchId, winnerTokenId, resultHash_inner))
 *      (see Arena._verifyOperatorSig for exact encoding).
 *   5. ECDSA-sign the eth-prefixed hash with the operator key.
 *   6. Call reportResult().
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  keccak256,
  encodePacked,
  toBytes,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ArenaAbi, addresses } from "@agentforge/shared";
import type { Abi } from "viem";
import { randomBytes } from "crypto";

// -------------------------------------------------------------------------
// Chain definition for 0G Galileo (chainId 16602)
// -------------------------------------------------------------------------

const ZG_GALILEO = {
  id: 16602,
  name: "0G Galileo",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evmrpc-testnet.0g.ai"] },
  },
} as const;

const ARENA_ADDRESS = addresses[16602].Arena;

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

export interface ResolveResult {
  matchId: bigint;
  agentA: bigint;
  agentB: bigint;
  winner: bigint;
  loser: bigint;
  eloA_before: number;
  eloB_before: number;
  txHashes: {
    accept: `0x${string}` | null;
    report: `0x${string}`;
  };
}

// MatchStatus enum mirrors Arena.sol
const MatchStatus = {
  Proposed: 0,
  Accepted: 1,
  Settled: 2,
  Cancelled: 3,
} as const;

// -------------------------------------------------------------------------
// ELO-weighted winner selection
// Standard ELO expected score: P(A wins) = 1 / (1 + 10^((Rb-Ra)/400))
// We seed with crypto.randomBytes so it's fair but deterministic-for-the-run.
// -------------------------------------------------------------------------

function pickWinner(tokenA: bigint, eloA: number, tokenB: bigint, eloB: number): bigint {
  const probA = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
  const buf = randomBytes(4);
  const rand = buf.readUInt32BE(0) / 0xffffffff; // [0, 1)
  return rand < probA ? tokenA : tokenB;
}

// -------------------------------------------------------------------------
// Core resolver
// -------------------------------------------------------------------------

export async function resolveMatch(
  matchId: bigint,
  operatorKey: `0x${string}`,
  rpcUrl?: string
): Promise<ResolveResult> {
  const rpc = rpcUrl ?? "https://evmrpc-testnet.0g.ai";

  const account = privateKeyToAccount(operatorKey);

  const publicClient = createPublicClient({
    chain: ZG_GALILEO,
    transport: http(rpc),
  });

  const walletClient = createWalletClient({
    account,
    chain: ZG_GALILEO,
    transport: http(rpc),
  });

  // -----------------------------------------------------------------------
  // 1. Read match state
  // -----------------------------------------------------------------------
  const match = await publicClient.readContract({
    address: ARENA_ADDRESS,
    abi: ArenaAbi as Abi,
    functionName: "getMatch",
    args: [matchId],
  }) as {
    agentA: bigint;
    agentB: bigint;
    winner: bigint;
    timestamp: bigint;
    resultHash: `0x${string}`;
    stake: bigint;
    proposer: `0x${string}`;
    acceptor: `0x${string}`;
    status: number;
  };

  if (match.status === MatchStatus.Settled) {
    throw new Error(`Match #${matchId} is already settled`);
  }
  if (match.status === MatchStatus.Cancelled) {
    throw new Error(`Match #${matchId} is cancelled`);
  }

  const { agentA, agentB, stake } = match;

  // -----------------------------------------------------------------------
  // 2. Accept match if still in Proposed state
  // -----------------------------------------------------------------------
  let acceptTxHash: `0x${string}` | null = null;

  if (match.status === MatchStatus.Proposed) {
    const acceptHash = await walletClient.writeContract({
      address: ARENA_ADDRESS,
      abi: ArenaAbi as Abi,
      functionName: "acceptMatch",
      args: [matchId],
      value: stake,
    });

    await publicClient.waitForTransactionReceipt({ hash: acceptHash });
    acceptTxHash = acceptHash;
  }

  // -----------------------------------------------------------------------
  // 3. Read ELO for both agents
  // -----------------------------------------------------------------------
  const [eloARaw, eloBRaw] = await Promise.all([
    publicClient.readContract({
      address: ARENA_ADDRESS,
      abi: ArenaAbi as Abi,
      functionName: "getElo",
      args: [agentA],
    }) as Promise<number>,
    publicClient.readContract({
      address: ARENA_ADDRESS,
      abi: ArenaAbi as Abi,
      functionName: "getElo",
      args: [agentB],
    }) as Promise<number>,
  ]);

  const eloA = Number(eloARaw);
  const eloB = Number(eloBRaw);

  // -----------------------------------------------------------------------
  // 4. Pick winner (ELO-weighted random)
  // -----------------------------------------------------------------------
  const winnerTokenId = pickWinner(agentA, eloA, agentB, eloB);
  const loserTokenId = winnerTokenId === agentA ? agentB : agentA;

  // -----------------------------------------------------------------------
  // 5. Build resultHash
  //    Arena._verifyOperatorSig hashes: keccak256(abi.encodePacked(matchId, winnerTokenId, resultHash))
  //    where resultHash itself is an arbitrary bytes32 (the "off-chain result proof").
  //    We set resultHash = keccak256(abi.encodePacked(matchId, winnerTokenId)) as the proof.
  //    Then the sig is over keccak256(abi.encodePacked(matchId, winnerTokenId, resultHash)).
  // -----------------------------------------------------------------------

  // Inner resultHash (proof of off-chain result)
  const resultHash: `0x${string}` = keccak256(
    encodePacked(["uint256", "uint256"], [matchId, winnerTokenId])
  );

  // The message that the contract will verify:
  // msgHash = keccak256(abi.encodePacked(matchId, winnerTokenId, resultHash))
  const msgHash: `0x${string}` = keccak256(
    encodePacked(["uint256", "uint256", "bytes32"], [matchId, winnerTokenId, resultHash])
  );

  // -----------------------------------------------------------------------
  // 6. Sign with eth_sign prefix (matches \x19Ethereum Signed Message:\n32)
  //    viem's signMessage adds the prefix automatically.
  // -----------------------------------------------------------------------
  const operatorSig = await walletClient.signMessage({
    message: { raw: toBytes(msgHash) },
  });

  // -----------------------------------------------------------------------
  // 7. Call reportResult
  // -----------------------------------------------------------------------
  const reportHash = await walletClient.writeContract({
    address: ARENA_ADDRESS,
    abi: ArenaAbi as Abi,
    functionName: "reportResult",
    args: [matchId, winnerTokenId, resultHash, operatorSig],
  });

  await publicClient.waitForTransactionReceipt({ hash: reportHash });

  return {
    matchId,
    agentA,
    agentB,
    winner: winnerTokenId,
    loser: loserTokenId,
    eloA_before: eloA,
    eloB_before: eloB,
    txHashes: {
      accept: acceptTxHash,
      report: reportHash,
    },
  };
}

// -------------------------------------------------------------------------
// Watch mode: poll for MatchProposed events and auto-resolve
// -------------------------------------------------------------------------

export async function watchAndResolve(
  operatorKey: `0x${string}`,
  pollIntervalMs = 10_000,
  rpcUrl?: string,
  onResolved?: (result: ResolveResult) => void,
  onError?: (matchId: bigint, err: unknown) => void
): Promise<never> {
  const rpc = rpcUrl ?? "https://evmrpc-testnet.0g.ai";

  const publicClient = createPublicClient({
    chain: ZG_GALILEO,
    transport: http(rpc),
  });

  const BLOCK_PAGE = 500n;
  let lastBlock = await publicClient.getBlockNumber();
  const resolvedSet = new Set<string>();

  console.log(`[watch] Polling for MatchProposed events every ${pollIntervalMs / 1000}s from block ${lastBlock}...`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));

    try {
      const latest = await publicClient.getBlockNumber();
      if (latest <= lastBlock) continue;

      const fromBlock = lastBlock + 1n;
      const toBlock = latest > fromBlock + BLOCK_PAGE ? fromBlock + BLOCK_PAGE : latest;

      const logs = await publicClient.getLogs({
        address: ARENA_ADDRESS,
        event: {
          type: "event",
          name: "MatchProposed",
          inputs: [
            { name: "matchId", type: "uint256", indexed: true },
            { name: "agentA",  type: "uint256", indexed: true },
            { name: "agentB",  type: "uint256", indexed: true },
            { name: "stake",   type: "uint256", indexed: false },
            { name: "proposer", type: "address", indexed: false },
          ],
        } as const,
        fromBlock,
        toBlock,
      });

      for (const log of logs) {
        const matchId = (log.args as { matchId: bigint }).matchId;
        const key = matchId.toString();
        if (resolvedSet.has(key)) continue;
        resolvedSet.add(key);

        console.log(`[watch] New match #${matchId} detected, resolving...`);
        try {
          const result = await resolveMatch(matchId, operatorKey, rpc);
          onResolved?.(result);
        } catch (err) {
          onError?.(matchId, err);
        }
      }

      lastBlock = toBlock;
    } catch (err) {
      console.error("[watch] Poll error:", err);
    }
  }
}
