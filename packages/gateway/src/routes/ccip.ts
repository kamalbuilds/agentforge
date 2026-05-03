import { Hono } from "hono";
import {
  decodeFunctionData,
  encodeAbiParameters,
  parseAbiParameters,
  toFunctionSelector,
  keccak256,
  slice,
  parseAbi,
  type Hex,
} from "viem";
import { clients } from "../onchain/clients.js";
import { AGENT_INFT_ABI, ARENA_HUB_ABI } from "../onchain/abis.js";
import { signCCIPResponse } from "../lib/eip3668.js";
import { logger } from "../lib/logger.js";
import { addresses } from "@agentforge/shared";

const router = new Hono<{ Bindings: Record<string, unknown> }>();

const ZG_CHAIN_ID = 16602; // 0G Galileo

// ─── ABI function selectors ───────────────────────────────────────────────────
const ADDR_SELECTOR   = toFunctionSelector("addr(bytes32)");
const TEXT_SELECTOR   = toFunctionSelector("text(bytes32,string)");

// ─── Core resolution logic ────────────────────────────────────────────────────

/**
 * Resolve an ENS resolver call against 0G Galileo state.
 * `sender`  = the OffchainResolver contract address (Sepolia)
 * `callData` = the original ABI-encoded resolver call (addr/text/…)
 *
 * Returns an ABI-encoded response ready to be verified by resolveWithProof:
 *   abi.encode(bytes result, uint64 expires, bytes signature)
 */
async function resolveCall(sender: string, callData: string): Promise<{ response: string }> {
  const agentForgeAddrs = addresses[ZG_CHAIN_ID as keyof typeof addresses];
  if (!agentForgeAddrs?.AgentINFT || !agentForgeAddrs?.Arena) {
    throw new Error("Contract addresses not configured for 0G Galileo (chainId 16602)");
  }

  const dataHex = callData as Hex;
  const selector = slice(dataHex, 0, 4) as Hex;

  let resultBytes: Hex;

  if (selector === ADDR_SELECTOR) {
    // addr(bytes32 node) → address
    // Interpret the node bytes32 as a token ID (big-endian uint256 — same as the node value)
    const decoded = decodeFunctionData({
      abi: parseAbi(["function addr(bytes32 node) view returns (address)"]),
      data: dataHex,
    });
    const node     = decoded.args[0] as Hex;
    const tokenId  = BigInt(node);

    logger.info({ tokenId: tokenId.toString() }, "CCIP addr() lookup");

    let owner: string;
    try {
      owner = await clients.zeroG.readContract({
        address: agentForgeAddrs.AgentINFT as `0x${string}`,
        abi: AGENT_INFT_ABI,
        functionName: "ownerOf",
        args: [tokenId],
      }) as string;
    } catch (err) {
      logger.warn({ tokenId: tokenId.toString(), error: String(err) }, "ownerOf failed, returning zero");
      owner = "0x0000000000000000000000000000000000000000";
    }

    logger.info({ tokenId: tokenId.toString(), owner }, "addr() resolved");

    resultBytes = encodeAbiParameters(
      parseAbiParameters("address"),
      [owner as `0x${string}`]
    );
  } else if (selector === TEXT_SELECTOR) {
    // text(bytes32 node, string key) → string
    const decoded = decodeFunctionData({
      abi: parseAbi(["function text(bytes32 node, string key) view returns (string)"]),
      data: dataHex,
    });
    const node    = decoded.args[0] as Hex;
    const key     = decoded.args[1] as string;
    const tokenId = BigInt(node);

    logger.info({ tokenId: tokenId.toString(), key }, "CCIP text() lookup");

    let value = "";
    try {
      if (key === "elo") {
        const elo = await clients.zeroG.readContract({
          address: agentForgeAddrs.Arena as `0x${string}`,
          abi: ARENA_HUB_ABI,
          functionName: "getElo",
          args: [tokenId],
        }) as bigint;
        value = elo.toString();
      } else if (key === "wins") {
        const wins = await clients.zeroG.readContract({
          address: agentForgeAddrs.Arena as `0x${string}`,
          abi: ARENA_HUB_ABI,
          functionName: "getWins",
          args: [tokenId],
        }) as bigint;
        value = wins.toString();
      } else if (key === "losses") {
        const losses = await clients.zeroG.readContract({
          address: agentForgeAddrs.Arena as `0x${string}`,
          abi: ARENA_HUB_ABI,
          functionName: "getLosses",
          args: [tokenId],
        }) as bigint;
        value = losses.toString();
      } else if (key === "bloodline") {
        const bl = await clients.zeroG.readContract({
          address: agentForgeAddrs.Arena as `0x${string}`,
          abi: ARENA_HUB_ABI,
          functionName: "getBloodline",
          args: [tokenId],
        }) as string;
        value = bl;
      } else {
        value = "";
      }
    } catch (err) {
      logger.warn({ tokenId: tokenId.toString(), key, error: String(err) }, "text() read failed, returning empty");
      value = "";
    }

    logger.info({ tokenId: tokenId.toString(), key, value }, "text() resolved");

    resultBytes = encodeAbiParameters(
      parseAbiParameters("string"),
      [value]
    );
  } else {
    throw new Error(`Unsupported resolver function: ${selector}`);
  }

  const expires = Math.floor(Date.now() / 1000) + 86400; // 24 hours
  const { signature } = await signCCIPResponse(sender, callData, resultBytes, expires);

  // The on-chain resolveWithProof expects: abi.decode(response, (bytes, uint64, bytes))
  const response = encodeAbiParameters(
    parseAbiParameters("bytes, uint64, bytes"),
    [resultBytes, BigInt(expires), signature as Hex]
  );

  return { response };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /ccip/{sender}/{data}.json
 * Standard EIP-3668 CCIP-Read URL template (used by ENS Universal Resolver).
 */
router.get("/:sender/:data", async (c) => {
  try {
    let sender = c.req.param("sender");
    let callData = c.req.param("data");

    // Strip trailing .json if present
    if (callData.endsWith(".json")) {
      callData = callData.slice(0, -5);
    }

    logger.info({ sender, callDataLength: callData.length }, "CCIP GET lookup");

    const { response } = await resolveCall(sender, callData);
    return c.json({ data: response });
  } catch (error) {
    logger.error({ error }, "CCIP GET error");
    return c.json({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

/**
 * POST /ccip/lookup
 * Alternative JSON-body endpoint for testing / non-standard clients.
 */
router.post("/lookup", async (c) => {
  try {
    const body = (await c.req.json()) as { sender: string; data: string };
    const { sender, data } = body;

    if (!sender || !data) {
      return c.json({ error: "Missing sender or data" }, 400);
    }

    logger.info({ sender, dataLength: data.length }, "CCIP POST lookup");

    const { response } = await resolveCall(sender, data);
    return c.json({ data: response });
  } catch (error) {
    logger.error({ error }, "CCIP POST error");
    return c.json({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

export default router;
