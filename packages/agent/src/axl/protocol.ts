/**
 * AXL message protocol types and helpers.
 * Ed25519 signing via @noble/ed25519.
 */
import * as ed from "@noble/ed25519";
import { z } from "zod";

// ─── Zod schemas ────────────────────────────────────────────────────────────

export const MatchProposeSchema = z.object({
  type: z.literal("MATCH_PROPOSE"),
  fromAgent: z.number().int().nonnegative(),
  toAgent: z.number().int().nonnegative(),
  stake: z.string().regex(/^\d+$/, "stake must be a decimal string (wei)"),
  timestamp: z.number().int().positive(),
});

export const MatchAcceptSchema = z.object({
  type: z.literal("MATCH_ACCEPT"),
  matchId: z.string().min(1),
  fromAgent: z.number().int().nonnegative(),
  signature: z.string().min(1),
});

export const MoveSchema = z.object({
  type: z.literal("MOVE"),
  matchId: z.string().min(1),
  agent: z.number().int().nonnegative(),
  payload: z.string(),
});

export const MatchResultSchema = z.object({
  type: z.literal("MATCH_RESULT"),
  matchId: z.string().min(1),
  winner: z.number().int().nonnegative(),
  resultHash: z.string().min(1),
  signatures: z.array(z.string()),
});

export const BreedOfferSchema = z.object({
  type: z.literal("BREED_OFFER"),
  fromAgent: z.number().int().nonnegative(),
  toAgent: z.number().int().nonnegative(),
  fee: z.string().regex(/^\d+$/, "fee must be a decimal string (wei)"),
});

export const AXLMessageSchema = z.discriminatedUnion("type", [
  MatchProposeSchema,
  MatchAcceptSchema,
  MoveSchema,
  MatchResultSchema,
  BreedOfferSchema,
]);

// ─── TypeScript types ────────────────────────────────────────────────────────

export type MatchPropose = z.infer<typeof MatchProposeSchema>;
export type MatchAccept = z.infer<typeof MatchAcceptSchema>;
export type Move = z.infer<typeof MoveSchema>;
export type MatchResult = z.infer<typeof MatchResultSchema>;
export type BreedOffer = z.infer<typeof BreedOfferSchema>;
export type AXLMessage =
  | MatchPropose
  | MatchAccept
  | Move
  | MatchResult
  | BreedOffer;

// ─── Envelope ───────────────────────────────────────────────────────────────

export interface AXLEnvelope {
  msg: AXLMessage;
  /** hex-encoded ed25519 public key of sender */
  pubkey: string;
  /** hex-encoded ed25519 signature over canonical JSON of msg */
  sig: string;
}

// ─── Encode / decode ─────────────────────────────────────────────────────────

/** Serialize message to canonical JSON bytes for signing */
export function canonicalBytes(msg: AXLMessage): Uint8Array {
  // Sorted keys for determinism
  const sorted = JSON.stringify(msg, Object.keys(msg).sort());
  return new TextEncoder().encode(sorted);
}

export function encodeMessage(msg: AXLMessage): string {
  return JSON.stringify(msg);
}

export function decodeMessage(raw: string): AXLMessage {
  const parsed = JSON.parse(raw) as unknown;
  return AXLMessageSchema.parse(parsed);
}

export function decodeEnvelope(raw: string): AXLEnvelope {
  const parsed = JSON.parse(raw) as AXLEnvelope;
  if (
    typeof parsed.msg !== "object" ||
    typeof parsed.pubkey !== "string" ||
    typeof parsed.sig !== "string"
  ) {
    throw new Error("Invalid AXL envelope structure");
  }
  parsed.msg = AXLMessageSchema.parse(parsed.msg);
  return parsed;
}

// ─── Signing ────────────────────────────────────────────────────────────────

/**
 * Sign an AXL message with an ed25519 private key.
 * privateKey: 32-byte Uint8Array
 * Returns hex-encoded signature.
 */
export async function signMessage(
  msg: AXLMessage,
  privateKey: Uint8Array
): Promise<string> {
  const bytes = canonicalBytes(msg);
  const sig = await ed.signAsync(bytes, privateKey);
  return Buffer.from(sig).toString("hex");
}

/**
 * Verify an AXL message signature.
 * pubkey: hex string (32 bytes = 64 hex chars)
 * sig: hex string
 */
export async function verifyMessage(
  msg: AXLMessage,
  sig: string,
  pubkey: string
): Promise<boolean> {
  const bytes = canonicalBytes(msg);
  const sigBytes = Buffer.from(sig, "hex");
  const pubBytes = Buffer.from(pubkey, "hex");
  return ed.verifyAsync(sigBytes, bytes, pubBytes);
}

/**
 * Build and sign a full envelope ready for AXL transport.
 */
export async function buildEnvelope(
  msg: AXLMessage,
  privateKey: Uint8Array
): Promise<AXLEnvelope> {
  const pubkey = Buffer.from(await ed.getPublicKeyAsync(privateKey)).toString(
    "hex"
  );
  const sig = await signMessage(msg, privateKey);
  return { msg, pubkey, sig };
}

/**
 * Derive the ed25519 private key bytes from the agent operator hex private key.
 * We use the first 32 bytes of the ECDSA private key as the ed25519 seed.
 * (In production you'd use a separate dedicated ed25519 key.)
 */
export function operatorKeyToEd25519(hexPrivKey: string): Uint8Array {
  const cleaned = hexPrivKey.startsWith("0x")
    ? hexPrivKey.slice(2)
    : hexPrivKey;
  if (cleaned.length < 64) {
    throw new Error("Operator key must be at least 32 bytes (64 hex chars)");
  }
  return Buffer.from(cleaned.slice(0, 64), "hex");
}
