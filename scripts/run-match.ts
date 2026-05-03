#!/usr/bin/env tsx
/**
 * run-match.ts — Demo match resolver for AgentForge Arena
 *
 * Resolves matches on-chain without requiring a live AXL agent stack.
 * Uses the deployer/operator key to accept + report results with real
 * ELO-weighted outcomes.
 *
 * Usage:
 *   tsx scripts/run-match.ts <matchId>        # resolve a single match
 *   tsx scripts/run-match.ts --watch          # daemon: auto-resolve new matches
 *
 * Environment (loaded from .env):
 *   DEPLOYER_PRIVATE_KEY  — operator key (also arena operator)
 *   ZG_RPC_URL            — optional RPC override
 */

// Load .env from repo root using dotenv from gateway's node_modules
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const dotenv = require(resolve(__dirname, "../packages/gateway/node_modules/dotenv"));
dotenv.config({ path: resolve(__dirname, "../.env") });

import { resolveMatch, watchAndResolve } from "../packages/gateway/src/lib/match-resolver.js";
import type { ResolveResult } from "../packages/gateway/src/lib/match-resolver.js";

const EXPLORER = "https://chainscan-galileo.0g.ai/tx";

function printResult(result: ResolveResult) {
  const explorer = (hash: `0x${string}` | null) =>
    hash ? `${EXPLORER}/${hash}` : "n/a";

  console.log("\n========================================");
  console.log(`Match #${result.matchId} RESOLVED`);
  console.log("========================================");
  console.log(`Agent A: #${result.agentA}  (ELO before: ${result.eloA_before})`);
  console.log(`Agent B: #${result.agentB}  (ELO before: ${result.eloB_before})`);
  console.log(`Winner:  #${result.winner}`);
  console.log(`Loser:   #${result.loser}`);
  console.log("----------------------------------------");
  if (result.txHashes.accept) {
    console.log(`Accept tx:  ${explorer(result.txHashes.accept)}`);
  }
  console.log(`Report tx:  ${explorer(result.txHashes.report)}`);
  console.log("========================================\n");
}

async function main() {
  const args = process.argv.slice(2);

  const operatorKey = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!operatorKey) {
    console.error("Error: DEPLOYER_PRIVATE_KEY is not set in environment / .env");
    process.exit(1);
  }

  const rpcUrl = process.env.ZG_RPC_URL;

  // --watch mode
  if (args[0] === "--watch") {
    console.log("Starting watch mode — will auto-resolve new MatchProposed events...");
    await watchAndResolve(
      operatorKey,
      10_000,
      rpcUrl,
      (result) => printResult(result),
      (matchId, err) => {
        console.error(`[watch] Failed to resolve match #${matchId}:`, err);
      }
    );
    return; // never returns
  }

  // Single match mode
  const matchIdArg = args[0];
  if (!matchIdArg || isNaN(Number(matchIdArg))) {
    console.error("Usage:");
    console.error("  tsx scripts/run-match.ts <matchId>");
    console.error("  tsx scripts/run-match.ts --watch");
    process.exit(1);
  }

  const matchId = BigInt(matchIdArg);

  console.log(`Resolving match #${matchId} on 0G Galileo...`);

  try {
    const result = await resolveMatch(matchId, operatorKey, rpcUrl);
    printResult(result);
  } catch (err) {
    console.error("Error:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
