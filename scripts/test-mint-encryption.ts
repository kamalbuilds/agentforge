/**
 * Smoke test: read genesis-aurelius.safetensors, run the same AES-256-GCM
 * encrypt/decrypt path that mint-form.tsx uses, assert round-trip integrity.
 *
 * Usage: npx tsx scripts/test-mint-encryption.ts
 */

import fs from "fs";
import path from "path";
import { webcrypto } from "crypto";

// Node 18+ has globalThis.crypto; older Node 18 may need the polyfill below.
const subtle: SubtleCrypto =
  (globalThis as unknown as { crypto: { subtle: SubtleCrypto } }).crypto?.subtle ??
  (webcrypto as unknown as { subtle: SubtleCrypto }).subtle;

const WEIGHTS_PATH = path.resolve(
  __dirname,
  "..",
  "demo",
  "weights",
  "genesis-aurelius.safetensors"
);

/** Mirrors mint-form.tsx encryptFile() exactly */
async function encryptBuffer(buffer: ArrayBuffer): Promise<{
  encryptedBuffer: ArrayBuffer;
  keyBytes: Uint8Array;
  iv: Uint8Array;
}> {
  const iv = (webcrypto as unknown as Crypto).getRandomValues(new Uint8Array(12));
  const key = await subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const ciphertext = await subtle.encrypt({ name: "AES-GCM", iv }, key, buffer);
  const rawKey = await subtle.exportKey("raw", key);
  const keyBytes = new Uint8Array(rawKey);

  // Pack: iv (12 bytes) || ciphertext
  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), 12);

  return { encryptedBuffer: combined.buffer, keyBytes, iv };
}

/** Mirrors the decrypt direction */
async function decryptBuffer(
  combined: ArrayBuffer,
  keyBytes: Uint8Array
): Promise<ArrayBuffer> {
  const arr = new Uint8Array(combined);
  const iv = arr.slice(0, 12);
  const ciphertext = arr.slice(12);

  const key = await subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  return subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function main() {
  console.log("=== AgentForge mint encryption smoke test ===\n");

  // 1. Read the real weight file
  if (!fs.existsSync(WEIGHTS_PATH)) {
    throw new Error(
      `Weight file not found: ${WEIGHTS_PATH}\n` +
        "Run: python scripts/generate-demo-weights.py"
    );
  }

  const rawBytes = fs.readFileSync(WEIGHTS_PATH);
  const inputBuffer: ArrayBuffer = rawBytes.buffer.slice(
    rawBytes.byteOffset,
    rawBytes.byteOffset + rawBytes.byteLength
  );

  console.log(`Input file : ${WEIGHTS_PATH}`);
  console.log(`Input size : ${rawBytes.length} bytes (${(rawBytes.length / 1024).toFixed(1)} KB)`);

  // Quick sanity: first 8 bytes are the safetensors header length (little-endian u64)
  const view = new DataView(inputBuffer);
  const headerLen = view.getBigUint64(0, /* little-endian */ true);
  console.log(`Safetensors header length: ${headerLen} bytes`);
  if (headerLen === 0n || headerLen > BigInt(rawBytes.length)) {
    throw new Error("File does not look like a valid safetensors file");
  }

  // 2. Encrypt
  const { encryptedBuffer, keyBytes } = await encryptBuffer(inputBuffer);
  const encryptedSize = encryptedBuffer.byteLength;

  console.log(`\nEncrypted size: ${encryptedSize} bytes (${(encryptedSize / 1024).toFixed(1)} KB)`);
  console.log(`  Expected overhead: 12 (IV) + 16 (GCM tag) = 28 bytes`);
  console.log(`  Actual overhead  : ${encryptedSize - rawBytes.length} bytes`);
  console.log(`Encryption key (hex): ${toHex(keyBytes)}`);

  if (encryptedSize === 0) throw new Error("Encrypted output is empty");
  if (encryptedSize < rawBytes.length) throw new Error("Encrypted output is shorter than input — something is wrong");

  // 3. Decrypt and verify round-trip
  const decryptedBuffer = await decryptBuffer(encryptedBuffer, keyBytes);
  const decryptedBytes = new Uint8Array(decryptedBuffer);

  if (decryptedBytes.length !== rawBytes.length) {
    throw new Error(
      `Round-trip length mismatch: got ${decryptedBytes.length}, expected ${rawBytes.length}`
    );
  }

  // Byte-for-byte comparison
  for (let i = 0; i < rawBytes.length; i++) {
    if (decryptedBytes[i] !== rawBytes[i]) {
      throw new Error(`Byte mismatch at offset ${i}`);
    }
  }

  console.log("\nDecrypted size: matches input exactly");
  console.log("Round-trip integrity: PASS");

  console.log("\n=== SMOKE TEST PASSED ===");
}

main().catch((err) => {
  console.error("\nSMOKE TEST FAILED:", err.message ?? err);
  process.exit(1);
});
