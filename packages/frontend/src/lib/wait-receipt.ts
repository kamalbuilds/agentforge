import type { PublicClient, TransactionReceipt } from "viem";

/**
 * 0G Galileo testnet's RPC indexer lags ~5-30s after broadcast and returns
 * "no matching receipts found" on eth_getTransactionReceipt during that window.
 * viem's built-in waitForTransactionReceipt does not retry that error class.
 * This wrapper polls with backoff for up to ~3 minutes.
 */
export async function waitForReceiptWithRetry(
  publicClient: PublicClient,
  hash: `0x${string}`,
  opts: { intervalMs?: number; maxAttempts?: number } = {},
): Promise<TransactionReceipt> {
  const intervalMs = opts.intervalMs ?? 3000;
  const maxAttempts = opts.maxAttempts ?? 60;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const receipt = await publicClient.getTransactionReceipt({ hash });
      if (receipt) return receipt;
    } catch (err) {
      const msg = (err as Error)?.message ?? "";
      if (
        msg.includes("no matching receipts") ||
        msg.includes("could not be found") ||
        msg.includes("Transaction receipt with hash")
      ) {
        // expected lag — retry
      } else {
        throw err;
      }
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Receipt not available after ${maxAttempts * intervalMs}ms for tx ${hash}`);
}
