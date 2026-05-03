import { Hono } from "hono";
import { fetch as nodeFetch } from "undici";
import { logger } from "../lib/logger.js";
import { getConfig } from "../config.js";

interface UploadRequest {
  buffer: string; // base64 encoded encrypted buffer
  metadata?: Record<string, unknown>;
}

interface UploadResponse {
  cid: string;
  txHash?: string;
}

const router = new Hono<{ Bindings: Record<string, unknown> }>();

/**
 * POST /storage/upload
 * Upload encrypted model weights to 0G Storage
 */
router.post("/upload", async (c) => {
  try {
    const config = getConfig();
    const body = (await c.req.json()) as UploadRequest;

    const { buffer, metadata } = body;

    if (!buffer) {
      return c.json({ error: "Missing buffer" }, 400);
    }

    logger.info(
      { metadataKeys: Object.keys(metadata || {}) },
      "Storage upload request"
    );

    // Decode base64 buffer
    let decodedBuffer: Buffer;
    try {
      decodedBuffer = Buffer.from(buffer, "base64");
    } catch (err) {
      logger.warn({ error: String(err) }, "Failed to decode buffer");
      return c.json({ error: "Invalid base64 buffer" }, 400);
    }

    // Upload to 0G Storage indexer
    let cid: string;
    try {
      const response = await nodeFetch(`${config.ZEROG_INDEXER_URL}/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
        },
        body: decodedBuffer,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json() as { cid?: string; root_hash?: string };
      cid = (result.cid || result.root_hash) as string;

      if (!cid) {
        throw new Error("No CID returned from upload");
      }

      logger.info({ cid, size: decodedBuffer.length }, "File uploaded to 0G Storage");
    } catch (err) {
      logger.error({ error: String(err) }, "Failed to upload to 0G Storage");
      return c.json(
        { error: "Failed to upload to storage: " + String(err) },
        500
      );
    }

    return c.json(
      {
        cid,
        txHash: undefined,
      } as UploadResponse
    );
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
 * Retrieve encrypted data from 0G Storage
 */
router.get("/:cid", async (c) => {
  try {
    const config = getConfig();
    const cid = c.req.param("cid");

    if (!cid) {
      return c.json({ error: "Missing CID" }, 400);
    }

    logger.info({ cid }, "Storage download request");

    // Download from 0G Storage indexer
    try {
      const response = await nodeFetch(`${config.ZEROG_INDEXER_URL}/download/${cid}`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const data = new Uint8Array(buffer);

      if (!data.length) {
        throw new Error("No data returned from download");
      }

      logger.info({ cid, size: data.length }, "File downloaded from 0G Storage");

      // Return as base64
      const base64 = Buffer.from(data).toString("base64");
      return c.json({ data: base64 });
    } catch (err) {
      logger.error({ cid, error: String(err) }, "Failed to download from 0G Storage");
      return c.json(
        { error: "Failed to download from storage: " + String(err) },
        404
      );
    }
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
