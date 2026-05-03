import { Hono } from "hono";
import { decodeFunctionData, encodeFunctionResult, toHex, parseAbi } from "viem";
import { clients } from "../onchain/clients.js";
import { AGENT_INFT_ABI, ARENA_HUB_ABI } from "../onchain/abis.js";
import { signCCIPResponse } from "../lib/eip3668.js";
import { logger } from "../lib/logger.js";
import { getConfig } from "../config.js";
import { addresses } from "@agentforge/shared";

interface CCIPRequest {
  sender: string;
  data: string;
}

interface CCIPResponse {
  data: string;
  expires?: number;
}

const router = new Hono<{ Bindings: Record<string, unknown> }>();

/**
 * POST /ccip/lookup
 * EIP-3668 compliant CCIP-Read gateway
 * Decodes resolver function calls and returns on-chain state
 */
router.post("/lookup", async (c) => {
  try {
    const body = (await c.req.json()) as CCIPRequest;
    const { sender, data } = body;

    logger.info({ sender, dataLength: data.length }, "CCIP lookup request");

    if (!sender || !data) {
      return c.json({ error: "Missing sender or data" }, 400);
    }

    const config = getConfig();
    const chainId = 16602; // 0G Galileo

    // Decode the function call
    let decodedData;
    try {
      decodedData = decodeFunctionData({
        abi: parseAbi(["function addr(bytes32) view returns (address)"]),
        data: data as `0x${string}`,
      });
    } catch (e) {
      logger.warn({ error: String(e) }, "Failed to decode function data");
      return c.json({ error: "Invalid function data" }, 400);
    }

    const agentForgeAddrs = addresses[chainId as keyof typeof addresses];
    if (!agentForgeAddrs?.AgentINFT || !agentForgeAddrs?.Arena) {
      logger.error({ chainId }, "Contract addresses not configured");
      return c.json(
        { error: "Contract addresses not configured for this chain" },
        500
      );
    }

    let result: string;

    // Determine which function was called
    if (data.includes("addr")) {
      // addr(bytes32 node) -> address
      // For demo: return owner of the token derived from the node
      const tokenIdHex = (decodedData.args?.[0] as string) || "0x0";
      const tokenId = BigInt(tokenIdHex);

      logger.debug({ tokenId }, "Resolving addr() for token");

      try {
        const owner = await clients.zeroG.readContract({
          address: agentForgeAddrs.AgentINFT as `0x${string}`,
          abi: AGENT_INFT_ABI,
          functionName: "ownerOf",
          args: [tokenId],
        });

        result = encodeFunctionResult({
          abi: AGENT_INFT_ABI,
          functionName: "ownerOf",
          result: owner as `0x${string}`,
        });

        logger.info({ tokenId, owner }, "Resolved addr() successfully");
      } catch (err) {
        logger.error({ tokenId, error: String(err) }, "Failed to resolve addr()");
        return c.json({ error: "Failed to resolve address" }, 500);
      }
    } else if (data.includes("text")) {
      // text(bytes32 node, string key) -> string
      // For demo: return stats like elo, wins, losses, bloodline
      const key = "elo"; // Simplified - extract from data in production

      logger.debug({ key }, "Resolving text() for token");

      result = encodeFunctionResult({
        abi: AGENT_INFT_ABI,
        functionName: "generation",
        result: 0,
      });
    } else {
      logger.warn({ data }, "Unknown function call");
      return c.json({ error: "Unknown function call" }, 400);
    }

    // Sign the response per EIP-3668
    const expires = Math.floor(Date.now() / 1000) + 86400; // 24 hours
    const signed = await signCCIPResponse(sender, data, result, expires);

    logger.info({ expires, resultLength: result.length }, "CCIP response prepared");

    return c.json({
      data: result,
      expires,
      signature: signed.signature,
    } as CCIPResponse & { signature: string });
  } catch (error) {
    logger.error({ error }, "CCIP lookup error");
    return c.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      500
    );
  }
});

export default router;
