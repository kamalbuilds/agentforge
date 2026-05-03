/**
 * KeeperHub API integration for reliable onchain execution.
 * Real contract-call execution with retry and MEV protection.
 */
import { fetch as undiciFetch, Agent } from "undici";
import type { Hex } from "viem";
import { getConfig } from "../config.js";
import { logger } from "../logger.js";

const _agent = new Agent({ allowH2: true, connections: 5 });

function baseUrl(): string {
  return getConfig().KEEPERHUB_API_URL.replace(/\/$/, "");
}

function authHeader(): Record<string, string> {
  return { Authorization: `Bearer ${getConfig().KEEPERHUB_API_KEY}` };
}

async function khFetch<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
  } = {}
): Promise<T> {
  const url = `${baseUrl()}${path}`;
  const res = await undiciFetch(url, {
    method: options.method ?? "GET",
    dispatcher: _agent,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  } as Parameters<typeof undiciFetch>[1]);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `KeeperHub ${options.method ?? "GET"} ${path} → ${res.status}: ${body}`
    );
  }

  return res.json() as Promise<T>;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExecuteTxOptions {
  /** Network identifier (e.g. "0g-galileo", "ethereum-sepolia") */
  network?: string;
  gasLimitMultiplier?: number;
  /** Retry count before giving up */
  maxRetries?: number;
}

export interface ExecuteTxResult {
  executionId: string;
  status: "pending" | "submitted" | "completed" | "failed";
  transactionHash?: Hex;
}

export interface ExecutionStatus {
  executionId: string;
  status: "pending" | "submitted" | "completed" | "failed";
  transactionHash?: Hex;
  error?: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Submit a smart contract call via KeeperHub for execution with retry/MEV protection.
 */
export async function executeTx(
  to: Hex,
  data: Hex,
  value: bigint,
  options: ExecuteTxOptions = {}
): Promise<ExecuteTxResult> {
  const network = options.network ?? "0g-galileo";

  logger.info({ to, network }, "KeeperHub executeTx");

  const result = await khFetch<ExecuteTxResult>("/execute/contract-call", {
    method: "POST",
    body: {
      contractAddress: to,
      network,
      // Pass raw calldata — KeeperHub supports raw data via the callData field
      callData: data,
      value: value.toString(),
      gasLimitMultiplier: options.gasLimitMultiplier ?? 1.3,
      // ABI is empty when passing raw callData
      abi: "[]",
      functionName: "fallback",
      functionArgs: "[]",
    },
  });

  logger.info(
    { executionId: result.executionId, status: result.status },
    "KeeperHub tx submitted"
  );

  // Poll for completion if not immediately done
  const maxRetries = options.maxRetries ?? 20;
  const POLL_INTERVAL_MS = 3_000;

  for (let i = 0; i < maxRetries; i++) {
    if (
      result.status === "completed" ||
      result.status === "failed"
    ) {
      break;
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const status = await getExecutionStatus(result.executionId);

    result.status = status.status;
    if (status.transactionHash) result.transactionHash = status.transactionHash;

    if (status.status === "completed" || status.status === "failed") {
      if (status.status === "failed") {
        throw new Error(
          `KeeperHub execution ${result.executionId} failed: ${status.error ?? "unknown"}`
        );
      }
      break;
    }
  }

  logger.info(
    { executionId: result.executionId, txHash: result.transactionHash },
    "KeeperHub execution complete"
  );

  return result;
}

/**
 * Poll execution status by ID.
 */
export async function getExecutionStatus(
  executionId: string
): Promise<ExecutionStatus> {
  return khFetch<ExecutionStatus>(`/execute/${executionId}/status`, {
    method: "GET",
  });
}
