/**
 * Viem clients for 0G Galileo testnet.
 * ABIs loaded from contracts/out build artifacts.
 * Addresses from @agentforge/shared.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { zeroGGalileo } from "@agentforge/shared";
import { agentForgeAddresses } from "@agentforge/shared";
import { getConfig } from "../config.js";
import { logger } from "../logger.js";

// ─── ABI imports ─────────────────────────────────────────────────────────────
// Use createRequire since we're in ESM but need to read JSON
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const ArenaArtifact = require("../../../contracts/out/Arena.sol/Arena.json") as {
  abi: unknown[];
};
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const BreedingMarketArtifact = require(
  "../../../contracts/out/BreedingMarket.sol/BreedingMarket.json"
) as { abi: unknown[] };
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const AgentINFTArtifact = require(
  "../../../contracts/out/AgentINFT.sol/AgentINFT.json"
) as { abi: unknown[] };

export const ARENA_ABI = ArenaArtifact.abi;
export const BREEDING_MARKET_ABI = BreedingMarketArtifact.abi;
export const AGENT_INFT_ABI = AgentINFTArtifact.abi;

// ─── Clients ─────────────────────────────────────────────────────────────────

let _publicClient: PublicClient | null = null;
let _walletClient: WalletClient | null = null;

export function getPublicClient(): PublicClient {
  if (_publicClient) return _publicClient;
  const cfg = getConfig();
  _publicClient = createPublicClient({
    chain: zeroGGalileo,
    transport: http(cfg.ZG_RPC_URL),
  });
  return _publicClient;
}

export function getWalletClient(): WalletClient {
  if (_walletClient) return _walletClient;
  const cfg = getConfig();
  const account = privateKeyToAccount(cfg.AGENT_OPERATOR_KEY as Hex);
  _walletClient = createWalletClient({
    account,
    chain: zeroGGalileo,
    transport: http(cfg.ZG_RPC_URL),
  });
  return _walletClient;
}

// ─── Addresses ───────────────────────────────────────────────────────────────

export function getArenaAddress(): Hex {
  const addr = agentForgeAddresses[16601].arenaHub;
  if (!addr) {
    throw new Error(
      "NOT_IMPLEMENTED: Arena contract address not set in @agentforge/shared — deploy contracts first"
    );
  }
  return addr as Hex;
}

export function getBreedingMarketAddress(): Hex {
  const addr = agentForgeAddresses[16601].breedingHub;
  if (!addr) {
    throw new Error(
      "NOT_IMPLEMENTED: BreedingMarket contract address not set in @agentforge/shared — deploy contracts first"
    );
  }
  return addr as Hex;
}

export function getAgentINFTAddress(): Hex {
  const addr = agentForgeAddresses[16601].agentNft;
  if (!addr) {
    throw new Error(
      "NOT_IMPLEMENTED: AgentINFT contract address not set in @agentforge/shared — deploy contracts first"
    );
  }
  return addr as Hex;
}

// ─── Contract reads ───────────────────────────────────────────────────────────

export async function getOnchainElo(tokenId: bigint): Promise<number> {
  const client = getPublicClient();
  const elo = await client.readContract({
    address: getArenaAddress(),
    abi: ARENA_ABI,
    functionName: "getElo",
    args: [tokenId],
  });
  return Number(elo);
}

export async function getOnchainWins(tokenId: bigint): Promise<number> {
  const client = getPublicClient();
  const wins = await client.readContract({
    address: getArenaAddress(),
    abi: ARENA_ABI,
    functionName: "wins",
    args: [tokenId],
  });
  return Number(wins);
}

export async function getOnchainLosses(tokenId: bigint): Promise<number> {
  const client = getPublicClient();
  const losses = await client.readContract({
    address: getArenaAddress(),
    abi: ARENA_ABI,
    functionName: "losses",
    args: [tokenId],
  });
  return Number(losses);
}

// ─── Encode reportResult calldata ────────────────────────────────────────────

import { encodeFunctionData } from "viem";

export interface ReportResultArgs {
  matchId: bigint;
  winnerTokenId: bigint;
  resultHash: Hex;
  operatorSig: Hex;
}

export function encodeReportResult(args: ReportResultArgs): Hex {
  return encodeFunctionData({
    abi: ARENA_ABI,
    functionName: "reportResult",
    args: [args.matchId, args.winnerTokenId, args.resultHash, args.operatorSig],
  });
}

export interface BreedFulfillArgs {
  reqId: bigint;
  offspringWeightCID: string;
  metadataCID: string;
  sealedKeyHash: Hex;
  operatorSig: Hex;
}

export function encodeFulfillBreed(args: BreedFulfillArgs): Hex {
  return encodeFunctionData({
    abi: BREEDING_MARKET_ABI,
    functionName: "fulfillBreed",
    args: [
      args.reqId,
      args.offspringWeightCID,
      args.metadataCID,
      args.sealedKeyHash,
      args.operatorSig,
    ],
  });
}

logger.debug("onchain/contracts module loaded");
