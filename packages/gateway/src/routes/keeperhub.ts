import { Hono } from "hono";
import { fetch as nodeFetch } from "undici";
import { logger } from "../lib/logger.js";
import { getConfig } from "../config.js";
import { z } from "zod";

const ExecuteRequestSchema = z.object({
  to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  data: z.string().startsWith("0x"),
  value: z.string().default("0"),
  chainId: z.number(),
});

const router = new Hono<{ Bindings: Record<string, unknown> }>();

/**
 * POST /keeperhub/execute
 * Forward transaction execution to KeeperHub with API key
 */
router.post("/execute", async (c) => {
  try {
    const config = getConfig();

    if (!config.KEEPERHUB_API_KEY) {
      return c.json({ error: "KeeperHub API key not configured" }, 401);
    }

    const body = (await c.req.json()) as unknown;
    const parsed = ExecuteRequestSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn({ errors: parsed.error.flatten() }, "Invalid execute request");
      return c.json(
        { error: "Invalid request: " + JSON.stringify(parsed.error.flatten()) },
        400
      );
    }

    const { to, data, value, chainId } = parsed.data;

    logger.info(
      { to, chainId, dataLength: data.length },
      "KeeperHub execute request"
    );

    // Forward to KeeperHub with API key
    const response = await nodeFetch(`${config.KEEPERHUB_BASE_URL}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.KEEPERHUB_API_KEY}`,
      },
      body: JSON.stringify({
        to,
        data,
        value,
        chainId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, error: errorText }, "KeeperHub error");
      return c.json(
        {
          error: `KeeperHub request failed with status ${response.status}: ${errorText}`,
        },
        {
          status: (response.status || 500) as 200 | 400 | 401 | 403 | 404 | 500,
        }
      );
    }

    const result = await response.json() as Record<string, unknown>;

    logger.info({ txHash: result.txHash }, "Transaction submitted to KeeperHub");

    return c.json(result);
  } catch (error) {
    logger.error({ error }, "KeeperHub execute error");
    return c.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      500
    );
  }
});

/**
 * GET /keeperhub/status/:jobId
 * Check status of a KeeperHub job
 */
router.get("/status/:jobId", async (c) => {
  try {
    const config = getConfig();
    const jobId = c.req.param("jobId");

    if (!jobId) {
      return c.json({ error: "Missing job ID" }, 400);
    }

    logger.info({ jobId }, "KeeperHub status request");

    if (!config.KEEPERHUB_API_KEY) {
      return c.json({ error: "KeeperHub API key not configured" }, 401);
    }

    const response = await nodeFetch(
      `${config.KEEPERHUB_BASE_URL}/status/${jobId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.KEEPERHUB_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        { jobId, status: response.status, error: errorText },
        "KeeperHub status error"
      );
      return c.json(
        { error: `Failed to fetch status: ${errorText}` },
        {
          status: (response.status || 500) as 200 | 400 | 401 | 403 | 404 | 500,
        }
      );
    }

    const result = await response.json() as Record<string, unknown>;

    logger.info({ jobId, status: result.status }, "KeeperHub status retrieved");

    return c.json(result);
  } catch (error) {
    logger.error({ error }, "KeeperHub status error");
    return c.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      500
    );
  }
});

export default router;
