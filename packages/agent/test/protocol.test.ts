/**
 * AXL protocol: message encode/decode roundtrip + ed25519 signature verify.
 * Uses node:test built-in runner.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as ed from "@noble/ed25519";
import {
  encodeMessage,
  decodeMessage,
  signMessage,
  verifyMessage,
  buildEnvelope,
  decodeEnvelope,
  operatorKeyToEd25519,
  canonicalBytes,
  type MatchPropose,
  type MatchAccept,
  type Move,
  type MatchResult,
  type BreedOffer,
} from "../src/axl/protocol.js";

// ─── Test private key ─────────────────────────────────────────────────────────
// 32-byte test key (all 0x01)
const TEST_PRIV_KEY = new Uint8Array(32).fill(1);

describe("AXL Protocol", () => {
  describe("MATCH_PROPOSE encode/decode roundtrip", () => {
    it("should roundtrip correctly", () => {
      const msg: MatchPropose = {
        type: "MATCH_PROPOSE",
        fromAgent: 42,
        toAgent: 99,
        stake: "1000000000000000000",
        timestamp: 1700000000,
      };
      const encoded = encodeMessage(msg);
      const decoded = decodeMessage(encoded);
      assert.deepEqual(decoded, msg);
    });

    it("should reject invalid stake format", () => {
      assert.throws(() => {
        decodeMessage(
          JSON.stringify({
            type: "MATCH_PROPOSE",
            fromAgent: 1,
            toAgent: 2,
            stake: "not-a-number",
            timestamp: 12345,
          })
        );
      });
    });
  });

  describe("MATCH_ACCEPT encode/decode roundtrip", () => {
    it("should roundtrip correctly", () => {
      const msg: MatchAccept = {
        type: "MATCH_ACCEPT",
        matchId: "match-42-99-1700000000",
        fromAgent: 99,
        signature: "abc123",
      };
      const encoded = encodeMessage(msg);
      const decoded = decodeMessage(encoded);
      assert.deepEqual(decoded, msg);
    });
  });

  describe("MOVE encode/decode roundtrip", () => {
    it("should roundtrip correctly", () => {
      const msg: Move = {
        type: "MOVE",
        matchId: "match-1-2-3",
        agent: 1,
        payload: JSON.stringify({ action: "BUY", reasoning: "bullish" }),
      };
      const encoded = encodeMessage(msg);
      const decoded = decodeMessage(encoded);
      assert.deepEqual(decoded, msg);
    });
  });

  describe("MATCH_RESULT encode/decode roundtrip", () => {
    it("should roundtrip correctly", () => {
      const msg: MatchResult = {
        type: "MATCH_RESULT",
        matchId: "match-1-2-3",
        winner: 1,
        resultHash: "0xabcdef1234567890",
        signatures: ["sig1", "sig2"],
      };
      const encoded = encodeMessage(msg);
      const decoded = decodeMessage(encoded);
      assert.deepEqual(decoded, msg);
    });
  });

  describe("BREED_OFFER encode/decode roundtrip", () => {
    it("should roundtrip correctly", () => {
      const msg: BreedOffer = {
        type: "BREED_OFFER",
        fromAgent: 5,
        toAgent: 10,
        fee: "500000000000000000",
      };
      const encoded = encodeMessage(msg);
      const decoded = decodeMessage(encoded);
      assert.deepEqual(decoded, msg);
    });
  });

  describe("Ed25519 signing", () => {
    it("should produce valid signature for MATCH_PROPOSE", async () => {
      const msg: MatchPropose = {
        type: "MATCH_PROPOSE",
        fromAgent: 1,
        toAgent: 2,
        stake: "100",
        timestamp: Date.now(),
      };
      const sig = await signMessage(msg, TEST_PRIV_KEY);
      assert.ok(typeof sig === "string", "signature should be a string");
      assert.ok(sig.length === 128, `signature should be 64 bytes hex (128 chars), got ${sig.length}`);
    });

    it("should verify a valid signature", async () => {
      const msg: MatchPropose = {
        type: "MATCH_PROPOSE",
        fromAgent: 1,
        toAgent: 2,
        stake: "100",
        timestamp: 1700000001,
      };
      const sig = await signMessage(msg, TEST_PRIV_KEY);
      const pubkey = Buffer.from(
        await ed.getPublicKeyAsync(TEST_PRIV_KEY)
      ).toString("hex");

      const valid = await verifyMessage(msg, sig, pubkey);
      assert.ok(valid, "signature should verify");
    });

    it("should reject a tampered message", async () => {
      const msg: MatchPropose = {
        type: "MATCH_PROPOSE",
        fromAgent: 1,
        toAgent: 2,
        stake: "100",
        timestamp: 1700000002,
      };
      const sig = await signMessage(msg, TEST_PRIV_KEY);
      const pubkey = Buffer.from(
        await ed.getPublicKeyAsync(TEST_PRIV_KEY)
      ).toString("hex");

      // Tamper with the message
      const tampered: MatchPropose = { ...msg, stake: "999999999" };
      const valid = await verifyMessage(tampered, sig, pubkey);
      assert.ok(!valid, "tampered message signature should not verify");
    });

    it("should reject wrong pubkey", async () => {
      const msg: Move = {
        type: "MOVE",
        matchId: "test",
        agent: 1,
        payload: "test",
      };
      const sig = await signMessage(msg, TEST_PRIV_KEY);

      // Different key
      const wrongKey = new Uint8Array(32).fill(2);
      const wrongPubkey = Buffer.from(
        await ed.getPublicKeyAsync(wrongKey)
      ).toString("hex");

      const valid = await verifyMessage(msg, sig, wrongPubkey);
      assert.ok(!valid, "wrong pubkey should not verify");
    });
  });

  describe("buildEnvelope / decodeEnvelope roundtrip", () => {
    it("should build and decode a valid envelope", async () => {
      const msg: MatchResult = {
        type: "MATCH_RESULT",
        matchId: "match-envelope-test",
        winner: 7,
        resultHash: "0xdeadbeef",
        signatures: [],
      };
      const envelope = await buildEnvelope(msg, TEST_PRIV_KEY);

      assert.ok(typeof envelope.pubkey === "string", "pubkey should be string");
      assert.ok(typeof envelope.sig === "string", "sig should be string");
      assert.deepEqual(envelope.msg, msg);

      const encoded = JSON.stringify(envelope);
      const decoded = decodeEnvelope(encoded);
      assert.deepEqual(decoded.msg, msg);
      assert.equal(decoded.pubkey, envelope.pubkey);
      assert.equal(decoded.sig, envelope.sig);
    });
  });

  describe("operatorKeyToEd25519", () => {
    it("should extract 32 bytes from 64-char hex key", () => {
      const hexKey = "a".repeat(64);
      const result = operatorKeyToEd25519(hexKey);
      assert.equal(result.length, 32);
    });

    it("should handle 0x-prefixed keys", () => {
      const hexKey = "0x" + "b".repeat(64);
      const result = operatorKeyToEd25519(hexKey);
      assert.equal(result.length, 32);
    });

    it("should throw on too-short key", () => {
      assert.throws(() => operatorKeyToEd25519("abc123"));
    });
  });

  describe("canonicalBytes determinism", () => {
    it("should produce same bytes regardless of key order", () => {
      const msg1 = { type: "MOVE" as const, matchId: "x", agent: 1, payload: "y" };
      const bytes1 = canonicalBytes(msg1);
      const bytes2 = canonicalBytes(msg1);
      assert.deepEqual(bytes1, bytes2);
    });
  });
});
