/**
 * AXL node HTTP client using undici for HTTP/2.
 * Endpoints based on AXL node API conventions.
 */
import { fetch as undiciFetch, Agent } from "undici";
import { getConfig } from "../config.js";
import { logger } from "../logger.js";
import type { AXLEnvelope } from "./protocol.js";

// Reuse a single undici agent with HTTP/2 support
const agent = new Agent({
  allowH2: true,
  connections: 10,
});

function baseUrl(): string {
  return getConfig().AXL_NODE_URL.replace(/\/$/, "");
}

async function axlFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const url = `${baseUrl()}${path}`;
  const res = await undiciFetch(url, {
    ...init,
    dispatcher: agent,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  } as Parameters<typeof undiciFetch>[1]);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AXL ${init.method ?? "GET"} ${path} → ${res.status}: ${body}`);
  }

  const text = await res.text();
  if (!text) return undefined as unknown as T;
  return JSON.parse(text) as T;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AXLPeer {
  id: string;
  addr: string;
  topics?: string[];
}

export interface AXLTopology {
  self: AXLPeer;
  peers: AXLPeer[];
}

export interface AXLRecvMessage {
  from: string;
  topic: string;
  payload: string;
  timestamp: number;
}

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * POST /send — send a message to a peer
 */
export async function send(
  peer: string,
  payload: string | object,
  topic?: string
): Promise<void> {
  const body: Record<string, unknown> = {
    peer,
    payload: typeof payload === "string" ? payload : JSON.stringify(payload),
  };
  if (topic) body["topic"] = topic;

  logger.debug({ peer, topic }, "AXL send");

  await axlFetch("/send", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * GET /recv?topic=... — long-poll receive messages on a topic.
 * Returns array of messages (may be empty if timeout).
 */
export async function recv(
  topic: string,
  timeoutMs = 30_000
): Promise<AXLRecvMessage[]> {
  logger.debug({ topic, timeoutMs }, "AXL recv poll");

  const params = new URLSearchParams({ topic, timeout: String(timeoutMs) });
  const result = await axlFetch<AXLRecvMessage[] | { messages: AXLRecvMessage[] }>(
    `/recv?${params.toString()}`,
    { method: "GET" }
  );

  // Handle both array response and {messages: [...]} envelope
  if (Array.isArray(result)) return result;
  if (result && "messages" in result) return result.messages;
  return [];
}

/**
 * GET /topology — list known peers
 */
export async function topology(): Promise<AXLTopology> {
  return axlFetch<AXLTopology>("/topology", { method: "GET" });
}

/**
 * POST /a2a/:path — A2A protocol message relay
 */
export async function a2aPost(
  path: string,
  body: unknown
): Promise<unknown> {
  return axlFetch(`/a2a/${path.replace(/^\//, "")}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Send a signed AXL envelope to a peer on a specific topic.
 */
export async function sendEnvelope(
  peer: string,
  envelope: AXLEnvelope,
  topic: string
): Promise<void> {
  await send(peer, JSON.stringify(envelope), topic);
}

/**
 * Long-poll receive and parse envelopes on a topic.
 * Returns raw messages; caller is responsible for parsing.
 */
export async function recvRaw(
  topic: string,
  timeoutMs = 30_000
): Promise<AXLRecvMessage[]> {
  return recv(topic, timeoutMs);
}
