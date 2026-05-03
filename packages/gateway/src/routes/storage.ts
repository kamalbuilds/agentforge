import { Hono } from "hono";
import { Indexer, MemData } from "@0glabs/0g-ts-sdk";
import { ethers } from "ethers";
import { logger } from "../lib/logger.js";
import { getConfig } from "../config.js";

const router = new Hono<{ Bindings: Record<string, unknown> }>();

/**
 * POST /storage/upload
 * Upload encrypted model weights to 0G Storage using the 0G TS SDK.
 * Request body: { buffer: string }  — base64-encoded binary payload
 * Response: { cid: string, txHash?: string }
 */
router.post("/upload", async (c) => {
  try {
    const config = getConfig();

    const body = (await c.req.json()) as { buffer?: string; metadata?: Record<string, unknown> };
    const { buffer } = body;

    if (!buffer) {
      return c.json({ error: "Missing buffer" }, 400);
    }

    // Decode base64 payload
    const decodedBuffer = Buffer.from(buffer, "base64");
    logger.info({ size: decodedBuffer.length }, "Storage upload: decoded buffer");

    const privateKey = config.DEPLOYER_PRIVATE_KEY ?? process.env.CCIP_SIGNER_KEY;
    if (!privateKey) {
      return c.json({ error: "No signing key configured for 0G storage uploads" }, 500);
    }

    const provider = new ethers.JsonRpcProvider(config.RPC_URL_0G);
    const signer = new ethers.Wallet(privateKey, provider);
    const indexer = new Indexer(config.ZEROG_INDEXER_URL);

    const memData = new MemData(decodedBuffer);

    logger.info(
      { indexer: config.ZEROG_INDEXER_URL, rpc: config.RPC_URL_0G, size: decodedBuffer.length },
      "Uploading to 0G Storage via SDK"
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [result, err] = await indexer.upload(memData, config.RPC_URL_0G, signer as any);

    if (err !== null) {
      logger.error({ error: String(err) }, "0G Storage upload failed");
      return c.json({ error: `Failed to upload to storage: ${String(err)}` }, 500);
    }

    logger.info({ cid: result.rootHash, txHash: result.txHash }, "File uploaded to 0G Storage");

    return c.json({ cid: result.rootHash, txHash: result.txHash });
  } catch (error) {
    logger.error({ error }, "Storage upload error");
    return c.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      500
    );
  }
});

/**
 * GET /storage/:cid
 * Retrieve encrypted data from 0G Storage.
 * Response: { data: string }  — base64-encoded binary payload
 */
router.get("/:cid", async (c) => {
  try {
    const config = getConfig();
    const cid = c.req.param("cid");

    if (!cid) {
      return c.json({ error: "Missing CID" }, 400);
    }

    logger.info({ cid }, "Storage download request");

    const indexer = new Indexer(config.ZEROG_INDEXER_URL);

    // Download to a temp path
    const tmpPath = `/tmp/0g-download-${Date.now()}-${cid.slice(0, 8)}`;
    const dlErr = await indexer.download(cid, tmpPath, false);

    if (dlErr !== null) {
      logger.error({ cid, error: String(dlErr) }, "Failed to download from 0G Storage");
      return c.json({ error: `Failed to download from storage: ${String(dlErr)}` }, 404);
    }

    const { readFileSync, unlinkSync } = await import("fs");
    const data = readFileSync(tmpPath);
    try { unlinkSync(tmpPath); } catch { /* best effort cleanup */ }

    logger.info({ cid, size: data.length }, "File downloaded from 0G Storage");
    return c.json({ data: data.toString("base64") });
  } catch (error) {
    logger.error({ error }, "Storage download error");
    return c.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      500
    );
  }
});

export default router;
