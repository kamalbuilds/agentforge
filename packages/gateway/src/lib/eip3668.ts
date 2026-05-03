import { Wallet } from "ethers";
import { keccak256, encodePacked, type Hex } from "viem";
import { getConfig } from "../config.js";
import { logger } from "./logger.js";

/**
 * EIP-3668 CCIP-Read response signing.
 *
 * Message hash follows the reference OffchainResolver:
 *   keccak256(abi.encodePacked(
 *     hex"1900",
 *     address(resolverContract),   // = sender (the on-chain resolver that emitted OffchainLookup)
 *     uint64(expires),
 *     keccak256(request),          // the original calldata (extraData passed through)
 *     keccak256(result)
 *   ))
 *
 * The on-chain resolveWithProof callback verifies the exact same hash.
 */
export async function signCCIPResponse(
  sender: string,           // resolver contract address (from OffchainLookup.sender)
  request: string,          // original calldata / extraData
  result: string,           // ABI-encoded result bytes
  expires: number           // unix timestamp
): Promise<{ signature: string }> {
  const config = getConfig();
  const signer = new Wallet(config.CCIP_SIGNER_KEY);

  const senderAddr = sender.startsWith("0x") ? (sender as `0x${string}`) : (`0x${sender}` as `0x${string}`);
  const requestHex = request.startsWith("0x") ? (request as `0x${string}`) : (`0x${request}` as `0x${string}`);
  const resultHex  = result.startsWith("0x")  ? (result  as `0x${string}`) : (`0x${result}`  as `0x${string}`);

  const requestHash = keccak256(requestHex);
  const resultHash  = keccak256(resultHex);
  const expiresBigInt = BigInt(expires);

  // Pack: 0x1900 + senderAddr + expires (uint64) + keccak256(request) + keccak256(result)
  const packed = encodePacked(
    ["bytes2", "address", "uint64", "bytes32", "bytes32"],
    ["0x1900", senderAddr, expiresBigInt, requestHash, resultHash]
  );

  const messageHash = keccak256(packed);

  // Sign with ethers (raw keccak, not personal_sign — matches on-chain ECDSA.recover)
  const sig = signer.signingKey.sign(messageHash);

  // Compact signature: r (32) + s (32) + v (1)
  const v = sig.v.toString(16).padStart(2, "0");
  const signature = `${sig.r}${sig.s.slice(2)}${v}` as `0x${string}`;

  logger.debug({ messageHash, signature }, "CCIP response signed");

  return { signature };
}
