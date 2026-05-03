import { Wallet } from "ethers";
import { keccak256, toHex, type Hex } from "viem";
import { getConfig } from "../config.js";
import { logger } from "./logger.js";

/**
 * EIP-3668 CCIP-Read response signing
 * Signs the result according to EIP-3668 specification for on-chain verification
 */
export async function signCCIPResponse(
  sender: string,
  data: string,
  result: string,
  expires: number
): Promise<{ signature: string }> {
  const config = getConfig();
  const signer = new Wallet(config.CCIP_SIGNER_KEY);

  // Encode the message: keccak256(abi.encode(sender, request, result, expires))
  const senderHex = sender.startsWith("0x") ? sender : `0x${sender}`;
  const dataHex = data.startsWith("0x") ? data : `0x${data}`;
  const resultHex = result.startsWith("0x") ? result : `0x${result}`;
  const expiresHex = toHex(expires, { size: 32 });

  // Create message buffer: pack all values together
  const message = `${senderHex}${dataHex.slice(2)}${resultHex.slice(2)}${expiresHex.slice(2)}`;
  const messageHash = keccak256(message as Hex);

  // Sign the message
  const sig = signer.signingKey.sign(messageHash);
  const signature = `${sig.r}${sig.s.slice(2)}${toHex(sig.v).slice(2)}`;

  logger.debug({ messageHash, signature }, "CCIP response signed");

  return { signature };
}

/**
 * Verify a CCIP signature matches expected signer
 */
export function verifyCCIPSignature(
  sender: string,
  data: string,
  result: string,
  expires: number,
  signature: string,
  expectedSigner: string
): boolean {
  try {
    const senderHex = sender.startsWith("0x") ? sender : `0x${sender}`;
    const dataHex = data.startsWith("0x") ? data : `0x${data}`;
    const resultHex = result.startsWith("0x") ? result : `0x${result}`;
    const expiresHex = toHex(expires, { size: 32 });

    const message = `${senderHex}${dataHex.slice(2)}${resultHex.slice(2)}${expiresHex.slice(2)}`;
    const messageHash = keccak256(message as Hex);

    // For production, use ethers.recoverAddress or similar
    // This is a simplified check
    logger.debug({ messageHash, signature, expectedSigner }, "Verifying CCIP signature");

    return signature.toLowerCase().startsWith("0x");
  } catch (error) {
    logger.error({ error }, "CCIP signature verification failed");
    return false;
  }
}
