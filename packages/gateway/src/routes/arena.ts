import { Hono } from "hono";
import { stream } from "hono/streaming";
import { fetch as nodeFetch } from "undici";
import { logger } from "../lib/logger.js";
import { getConfig } from "../config.js";
import { z } from "zod";

const ProposeMatchSchema = z.object({
  fromAgent: z.string().regex(/^\d+$/),
  toAgent: z.string().regex(/^\d+$/),
  stake: z.string().regex(/^\d+$/),
});

const router = new Hono<{ Bindings: Record<string, unknown> }>();

/**
 * GET /arena/stream
 * Server-sent events stream for arena match events
 */
router.get("/stream", async (c) => {
  try {
    const config = getConfig();

    logger.info("Arena stream request");

    return stream(c, async (writer) => {
      try {
        // Poll the AXL node for events
        let lastEventTime = Date.now();
        const pollInterval = 1000; // 1 second

        const pollLoop = async () => {
          while (true) {
            try {
              const response = await nodeFetch(
                `${config.AXL_NODE_URL}/recv?topic=arena&since=${lastEventTime}`,
                {
                  method: "GET",
                  signal: AbortSignal.timeout(30000), // 30 second timeout per request
                }
              );

              if (!response.ok) {
                logger.warn(
                  { status: response.status },
                  "AXL node error, retrying"
                );
                await new Promise((r) => setTimeout(r, pollInterval));
                continue;
              }

              const text = await response.text();
              const lines = text.split("\n").filter((l) => l.trim());

              for (const line of lines) {
                try {
                  const event = JSON.parse(line);
                  await writer.write(`data: ${JSON.stringify(event)}\n\n`);
                  lastEventTime = Date.now();
                } catch (e) {
                  logger.warn({ error: String(e) }, "Failed to parse event");
                }
              }

              // Small delay between polls
              await new Promise((r) => setTimeout(r, pollInterval));
            } catch (err) {
              logger.warn({ error: String(err) }, "Poll error, reconnecting");
              await new Promise((r) => setTimeout(r, pollInterval));
            }
          }
        };

        // Start polling
        await pollLoop();
      } catch (error) {
        logger.error({ error }, "Stream error");
        await writer.write(`data: ${JSON.stringify({ error: String(error) })}\n\n`);
      }
    });
  } catch (error) {
    logger.error({ error }, "Arena stream setup error");
    return c.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      500
    );
  }
});

/**
 * POST /arena/propose
 * Propose a match between two agents
 */
router.post("/propose", async (c) => {
  try {
    const config = getConfig();
    const body = (await c.req.json()) as unknown;

    const parsed = ProposeMatchSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn({ errors: parsed.error.flatten() }, "Invalid propose request");
      return c.json({ error: "Invalid request" }, 400);
    }

    const { fromAgent, toAgent, stake } = parsed.data;

    logger.info({ fromAgent, toAgent, stake }, "Arena propose request");

    const response = await nodeFetch(`${config.AXL_NODE_URL}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic: "arena",
        message: {
          type: "MATCH_PROPOSE",
          fromAgent,
          toAgent,
          stake,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        { status: response.status, error: errorText },
        "AXL send error"
      );
      return c.json(
        { error: `Failed to propose match: ${errorText}` },
        {
          status: (response.status || 500) as 200 | 400 | 401 | 403 | 404 | 500,
        }
      );
    }

    const result = await response.json() as Record<string, unknown>;

    logger.info({ messageId: (result as {messageId?: string}).messageId }, "Match proposed");

    return c.json(result);
  } catch (error) {
    logger.error({ error }, "Arena propose error");
    return c.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      500
    );
  }
});

/**
 * GET /arena/peers
 * Get connected peers from AXL topology
 */
router.get("/peers", async (c) => {
  try {
    const config = getConfig();

    logger.info("Arena peers request");

    const response = await nodeFetch(`${config.AXL_NODE_URL}/topology`, {
      method: "GET",
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, error: errorText }, "AXL topology error");
      return c.json(
        { error: `Failed to fetch topology: ${errorText}` },
        {
          status: (response.status || 500) as 200 | 400 | 401 | 403 | 404 | 500,
        }
      );
    }

    const result = await response.json() as Record<string, unknown>;

    logger.info({ peerCount: (result as {peers?: unknown[]}).peers?.length }, "Topology retrieved");

    return c.json(result);
  } catch (error) {
    logger.error({ error }, "Arena peers error");
    return c.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      500
    );
  }
});

export default router;
