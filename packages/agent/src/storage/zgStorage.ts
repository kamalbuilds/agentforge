/**
 * 0G Storage integration using @0glabs/0g-ts-sdk.
 * AES-256-GCM encryption/decryption + Indexer upload/download.
 */
import { Indexer, MemData } from "@0glabs/0g-ts-sdk";
import { ethers } from "ethers";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getConfig } from "../config.js";
import { logger } from "../logger.js";

const AES_ALGO = "aes-256-gcm" as const;
const IV_BYTES = 12; // 96-bit IV for GCM
const TAG_BYTES = 16;

export interface UploadResult {
  cid: string;   // rootHash from 0G storage
  txHash: string;
}

/**
 * AES-256-GCM encrypt then upload to 0G Storage via Indexer.
 * Returns the rootHash (used as CID) and the submission txHash.
 */
export async function uploadEncrypted(
  buffer: Buffer,
  encryptionKey: Uint8Array
): Promise<UploadResult> {
  if (encryptionKey.length !== 32) {
    throw new Error(
      `uploadEncrypted: encryptionKey must be 32 bytes, got ${encryptionKey.length}`
    );
  }

  const cfg = getConfig();

  // AES-256-GCM encrypt
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(AES_ALGO, Buffer.from(encryptionKey), iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Layout: [iv (12)] | [tag (16)] | [ciphertext]
  const payload = Buffer.concat([iv, tag, encrypted]);

  // Build signer for gas payment
  const provider = new ethers.JsonRpcProvider(cfg.ZG_RPC_URL);
  const signer = new ethers.Wallet(cfg.AGENT_OPERATOR_KEY, provider);

  const indexer = new Indexer(cfg.ZG_STORAGE_INDEXER);
  const memData = new MemData(payload);

  const [tree, treeErr] = await memData.merkleTree();
  if (treeErr) {
    throw new Error(`uploadEncrypted: merkle tree error: ${treeErr.message}`);
  }
  const rootHash = tree!.rootHash();

  logger.debug({ rootHash, payloadBytes: payload.length }, "uploading to 0G storage");

  // The 0G SDK expects ethers.Signer from their bundled version.
  // We pass our Wallet with a double-cast since the structural interface is identical
  // but TypeScript treats the ESM vs CJS module paths as incompatible types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, uploadErr] = await indexer.upload(
    memData,
    cfg.ZG_RPC_URL,
    signer as unknown as any, // eslint-disable-line @typescript-eslint/no-unsafe-argument
    {
      tags: "0x",
      finalityRequired: false,
      taskSize: 10,
      expectedReplica: 1,
      skipTx: false,
      fee: BigInt(0),
    }
  );

  if (uploadErr) {
    throw new Error(`uploadEncrypted: upload failed: ${uploadErr.message}`);
  }

  logger.info({ cid: result.rootHash, txHash: result.txHash }, "0G upload complete");

  return { cid: result.rootHash, txHash: result.txHash };
}

/**
 * Download from 0G Storage by rootHash/CID then AES-256-GCM decrypt.
 */
export async function downloadDecrypted(
  cid: string,
  encryptionKey: Uint8Array
): Promise<Buffer> {
  if (encryptionKey.length !== 32) {
    throw new Error(
      `downloadDecrypted: encryptionKey must be 32 bytes, got ${encryptionKey.length}`
    );
  }

  const cfg = getConfig();
  const indexer = new Indexer(cfg.ZG_STORAGE_INDEXER);

  // We use a temp file approach since Indexer.download writes to disk.
  // Use /tmp with the rootHash as filename.
  const os = await import("node:os");
  const path = await import("node:path");
  const fs = await import("node:fs/promises");

  const tmpFile = path.join(os.tmpdir(), `zgdl-${cid.replace(/[^a-zA-Z0-9]/g, "")}.bin`);

  logger.debug({ cid, tmpFile }, "downloading from 0G storage");

  const downloadErr = await indexer.download(cid, tmpFile, false);
  if (downloadErr) {
    throw new Error(`downloadDecrypted: download failed: ${downloadErr.message}`);
  }

  const payload = await fs.readFile(tmpFile);
  await fs.unlink(tmpFile).catch(() => undefined);

  if (payload.length < IV_BYTES + TAG_BYTES) {
    throw new Error(
      `downloadDecrypted: payload too short (${payload.length} bytes), cannot decrypt`
    );
  }

  const iv = payload.subarray(0, IV_BYTES);
  const tag = payload.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = payload.subarray(IV_BYTES + TAG_BYTES);

  const decipher = createDecipheriv(AES_ALGO, Buffer.from(encryptionKey), iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  logger.debug({ cid, decryptedBytes: decrypted.length }, "0G download+decrypt complete");

  return decrypted;
}
