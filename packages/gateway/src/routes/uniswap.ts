import { Hono } from "hono";
import { fetch as nodeFetch } from "undici";
import { logger } from "../lib/logger.js";
import { getConfig } from "../config.js";
import { z } from "zod";

const QuoteQuerySchema = z.object({
  tokenIn: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  tokenOut: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.string(),
  chainId: z.string().transform((v) => parseInt(v)),
});

const router = new Hono<{ Bindings: Record<string, unknown> }>();

/**
 * GET /uniswap/quote
 * Proxy Uniswap trade API quote endpoint
 */
router.get("/quote", async (c) => {
  try {
    const config = getConfig();

    const parsed = QuoteQuerySchema.safeParse(c.req.query());

    if (!parsed.success) {
      logger.warn({ errors: parsed.error.flatten() }, "Invalid quote request");
      return c.json(
        { error: "Invalid request parameters" },
        400
      );
    }

    const { tokenIn, tokenOut, amount, chainId } = parsed.data;

    logger.info(
      { tokenIn, tokenOut, amount, chainId },
      "Uniswap quote request"
    );

    if (!config.UNISWAP_API_KEY) {
      logger.warn("Uniswap API key not configured");
      return c.json({ error: "Uniswap API key not configured" }, 501);
    }

    // Build query params for Uniswap
    const params = new URLSearchParams({
      tokenInAddress: tokenIn,
      tokenOutAddress: tokenOut,
      tokenInChainId: String(chainId),
      tokenOutChainId: String(chainId),
      amount,
      type: "exactIn",
    });

    const url = `${config.UNISWAP_BASE_URL}/v1/quote?${params.toString()}`;

    const response = await nodeFetch(url, {
      method: "GET",
      headers: {
        "x-api-key": config.UNISWAP_API_KEY,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        { status: response.status, error: errorText },
        "Uniswap API error"
      );
      return c.json(
        { error: `Uniswap API error: ${errorText}` },
        {
          status: (response.status || 500) as 200 | 400 | 401 | 403 | 404 | 500,
        }
      );
    }

    const result = await response.json() as Record<string, unknown>;

    logger.info({ quoteId: (result as {quoteId?: string}).quoteId }, "Quote retrieved");

    return c.json(result);
  } catch (error) {
    logger.error({ error }, "Uniswap quote error");
    return c.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      500
    );
  }
});

/**
 * POST /uniswap/swap
 * Submit a swap transaction via Uniswap
 */
router.post("/swap", async (c) => {
  try {
    const config = getConfig();

    const body = (await c.req.json()) as unknown;

    if (!body) {
      return c.json({ error: "Missing request body" }, 400);
    }

    logger.info("Uniswap swap request");

    if (!config.UNISWAP_API_KEY) {
      return c.json({ error: "Uniswap API key not configured" }, 501);
    }

    const response = await nodeFetch(`${config.UNISWAP_BASE_URL}/v1/swap`, {
      method: "POST",
      headers: {
        "x-api-key": config.UNISWAP_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        { status: response.status, error: errorText },
        "Uniswap swap error"
      );
      return c.json(
        { error: `Uniswap swap failed: ${errorText}` },
        {
          status: (response.status || 500) as 200 | 400 | 401 | 403 | 404 | 500,
        }
      );
    }

    const result = await response.json() as Record<string, unknown>;

    logger.info({ txHash: (result as {txHash?: string}).txHash }, "Swap submitted");

    return c.json(result);
  } catch (error) {
    logger.error({ error }, "Uniswap swap error");
    return c.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      500
    );
  }
});

export default router;
