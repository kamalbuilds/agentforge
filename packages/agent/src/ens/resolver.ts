/**
 * ENS resolution on Sepolia for {tokenId}.agentforge.eth
 * Reads text records: elo, wins, losses, bloodline
 */
import {
  createPublicClient,
  http,
  type PublicClient,
} from "viem";
import { sepolia } from "viem/chains";
import { logger } from "../logger.js";

export interface AgentEnsProfile {
  tokenId: number;
  address?: `0x${string}`;
  elo?: number;
  wins?: number;
  losses?: number;
  bloodline?: string;
  ensName?: string;
}

let _sepoliaClient: PublicClient | null = null;

function getSepoliaClient(): PublicClient {
  if (_sepoliaClient) return _sepoliaClient;
  _sepoliaClient = createPublicClient({
    chain: sepolia,
    // Use public RPC — no auth needed for ENS reads
    transport: http("https://rpc.sepolia.org"),
  });
  return _sepoliaClient;
}

/**
 * Resolve {tokenId}.agentforge.eth on Sepolia.
 * Returns profile with all available text records.
 */
export async function resolveAgentEns(
  tokenId: number
): Promise<AgentEnsProfile> {
  const ensName = `${tokenId}.agentforge.eth`;
  const client = getSepoliaClient();

  logger.debug({ ensName }, "resolving ENS");

  let address: `0x${string}` | undefined;
  try {
    const resolved = await client.getEnsAddress({ name: ensName });
    if (resolved) address = resolved;
  } catch (err) {
    logger.debug({ err, ensName }, "ENS address resolution failed");
  }

  // Read text records in parallel
  const records = await Promise.allSettled([
    client.getEnsText({ name: ensName, key: "elo" }),
    client.getEnsText({ name: ensName, key: "wins" }),
    client.getEnsText({ name: ensName, key: "losses" }),
    client.getEnsText({ name: ensName, key: "bloodline" }),
  ]);

  const getValue = (r: PromiseSettledResult<string | null>): string | null =>
    r.status === "fulfilled" ? r.value : null;

  const eloStr = getValue(records[0]!);
  const winsStr = getValue(records[1]!);
  const lossesStr = getValue(records[2]!);
  const bloodline = getValue(records[3]!) ?? undefined;

  const profile: AgentEnsProfile = {
    tokenId,
    address,
    ensName,
    elo: eloStr !== null ? Number(eloStr) : undefined,
    wins: winsStr !== null ? Number(winsStr) : undefined,
    losses: lossesStr !== null ? Number(lossesStr) : undefined,
    bloodline,
  };

  logger.debug({ profile }, "ENS profile resolved");

  return profile;
}
