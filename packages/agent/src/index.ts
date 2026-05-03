/**
 * Agent runtime entrypoint.
 * Loads config, initializes clients, and runs either arena or breeding loop.
 */
import { getConfig } from "./config.js";
import { logger } from "./logger.js";
import { getWalletClient, getPublicClient } from "./onchain/contracts.js";
import { startArenaRunner } from "./arena/runner.js";
import { startBreedingMerger } from "./breeding/merger.js";

async function main() {
  try {
    logger.info("Agent runtime starting");

    const config = getConfig();
    logger.info(
      { tokenId: config.AGENT_TOKEN_ID.toString(), mode: config.BREEDING_OPERATOR ? "breeding" : "arena" },
      "Agent loaded"
    );

    // Initialize clients
    const walletClient = getWalletClient();
    const publicClient = getPublicClient();
    logger.info("Onchain clients initialized");

    // Start appropriate loop
    if (config.BREEDING_OPERATOR) {
      logger.info("Starting breeding/merger loop");
      await startBreedingMerger();
    } else {
      logger.info("Starting arena runner loop");
      await startArenaRunner();
    }
  } catch (err) {
    logger.fatal({ err }, "Fatal error in agent runtime");
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

main().catch((err) => {
  logger.fatal({ err }, "Unhandled error");
  process.exit(1);
});
