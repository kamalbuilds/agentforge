/**
 * Uniswap Trading API client.
 * Real GET /quote and POST /swap via https://trade-api.gateway.uniswap.org/v1/
 */
import { fetch as undiciFetch, Agent } from "undici";
import { getConfig } from "../config.js";
import { logger } from "../logger.js";

const UNISWAP_API_BASE = "https://trade-api.gateway.uniswap.org/v1";

const _agent = new Agent({ allowH2: true, connections: 5 });

function apiKey(): string {
  const cfg = getConfig();
  if (!cfg.UNISWAP_API_KEY) {
    throw new Error(
      "NOT_IMPLEMENTED: UNISWAP_API_KEY env var not set — set it to use Uniswap Trading API"
    );
  }
  return cfg.UNISWAP_API_KEY;
}

async function uniswapFetch<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    params?: Record<string, string>;
    body?: unknown;
  } = {}
): Promise<T> {
  const url = new URL(`${UNISWAP_API_BASE}${path}`);
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await undiciFetch(url.toString(), {
    method: options.method ?? "GET",
    dispatcher: _agent,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey(),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  } as Parameters<typeof undiciFetch>[1]);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Uniswap API ${options.method ?? "GET"} ${path} → ${res.status}: ${body}`
    );
  }

  return res.json() as Promise<T>;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UniswapQuoteParams {
  tokenInChainId: number;
  tokenOutChainId: number;
  tokenIn: string;
  tokenOut: string;
  amount: string;
  /** "EXACT_INPUT" | "EXACT_OUTPUT" */
  type: "EXACT_INPUT" | "EXACT_OUTPUT";
  swapper?: string;
}

export interface UniswapQuoteResponse {
  quote: {
    chainId: number;
    swapper: string;
    input: { token: string; amount: string };
    output: { token: string; amount: string; minimumAmount: string };
    slippage: { tolerance: string };
    priceImpact: string;
    gasFee: string;
    gasFeeUSD: string;
    routeString: string;
    quoteId: string;
  };
}

export interface UniswapSwapParams {
  quote: UniswapQuoteResponse["quote"];
  /** Signer address */
  swapper: string;
  slippageTolerance?: string;
}

export interface UniswapSwapResponse {
  swap: {
    chainId: number;
    to: string;
    data: string;
    value: string;
    gasLimit: string;
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * GET /quote — fetch a swap quote from Uniswap Trading API.
 */
export async function getQuote(
  params: UniswapQuoteParams
): Promise<UniswapQuoteResponse> {
  logger.debug(
    { tokenIn: params.tokenIn, tokenOut: params.tokenOut, amount: params.amount },
    "uniswap getQuote"
  );

  return uniswapFetch<UniswapQuoteResponse>("/quote", {
    method: "GET",
    params: {
      tokenInChainId: String(params.tokenInChainId),
      tokenOutChainId: String(params.tokenOutChainId),
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amount: params.amount,
      type: params.type,
      ...(params.swapper ? { swapper: params.swapper } : {}),
    },
  });
}

/**
 * POST /swap — get Universal Router calldata for a quoted swap.
 */
export async function getSwapCalldata(
  params: UniswapSwapParams
): Promise<UniswapSwapResponse> {
  logger.debug(
    { quoteId: params.quote.quoteId, swapper: params.swapper },
    "uniswap getSwap"
  );

  return uniswapFetch<UniswapSwapResponse>("/swap", {
    method: "POST",
    body: {
      quote: params.quote,
      swapper: params.swapper,
      slippageTolerance: params.slippageTolerance ?? "0.5",
    },
  });
}
