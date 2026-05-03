/**
 * Seed Genesis Agents Script
 *
 * Mints 5 sample genesis agents with unique traits on 0G Chain.
 * These agents populate the initial state for demo/testing.
 *
 * Usage: npx tsx scripts/seed-agents.ts
 */

import "dotenv/config";
import { createWalletClient, http, publicActions, keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { parseEther } from "viem";

// ABI for AgentINFT mint function
const AGENT_INFT_ABI = [
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "weightCID", type: "string" },
      { name: "metadataCID", type: "string" },
      { name: "parentA", type: "uint256" },
      { name: "parentB", type: "uint256" },
      { name: "sealedKeyHash", type: "bytes32" },
    ],
    name: "mint",
    outputs: [{ name: "tokenId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

interface SeedAgent {
  name: string;
  personality: string;
  sealedKeyHash: string;
}

const GENESIS_AGENTS: SeedAgent[] = [
  {
    name: "Aurelius",
    personality: "stoic_trader",
    sealedKeyHash: keccak256(toBytes("aurelius-sealed-key-001")),
  },
  {
    name: "Vesper",
    personality: "risk_arbitrageur",
    sealedKeyHash: keccak256(toBytes("vesper-sealed-key-002")),
  },
  {
    name: "Borealis",
    personality: "momentum_hunter",
    sealedKeyHash: keccak256(toBytes("borealis-sealed-key-003")),
  },
  {
    name: "Cassia",
    personality: "value_seeker",
    sealedKeyHash: keccak256(toBytes("cassia-sealed-key-004")),
  },
  {
    name: "Drogon",
    personality: "volatility_rider",
    sealedKeyHash: keccak256(toBytes("drogon-sealed-key-005")),
  },
];

async function seedAgents() {
  // Validate environment
  const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY;
  const RPC_URL = process.env.ZG_RPC_URL;
  const CHAIN_ID = parseInt(process.env.ZG_CHAIN_ID || "16601", 10);
  const AGENT_INFT_CONTRACT = process.env.AGENT_INFT_ADDRESS;

  if (!DEPLOYER_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY not set in .env");
  }

  if (!RPC_URL) {
    throw new Error("ZG_RPC_URL not set in .env");
  }

  if (!AGENT_INFT_CONTRACT) {
    throw new Error("AGENT_INFT_ADDRESS not set in .env");
  }

  console.log("Seeding genesis agents...");
  console.log(`Chain ID: ${CHAIN_ID}`);
  console.log(`RPC: ${RPC_URL}`);
  console.log(`AgentINFT: ${AGENT_INFT_CONTRACT}`);

  // Create wallet
  const account = privateKeyToAccount(`0x${DEPLOYER_KEY}`);
  const client = createWalletClient({
    account,
    chain: {
      id: CHAIN_ID,
      name: "0G Chain",
      nativeCurrency: { name: "Neuron", symbol: "neuron", decimals: 18 },
      rpcUrls: {
        default: { http: [RPC_URL] },
      },
    },
    transport: http(RPC_URL),
  }).extend(publicActions);

  console.log(`Deployer: ${account.address}`);

  // Verify contract is accessible
  const code = await client.getCode({
    address: AGENT_INFT_CONTRACT as `0x${string}`,
  });

  if (code === "0x") {
    throw new Error(`AgentINFT contract not found at ${AGENT_INFT_CONTRACT}`);
  }

  console.log("AgentINFT contract verified\n");

  // Mint each genesis agent
  const results: { tokenId: string; name: string; txHash: string }[] = [];

  for (const agent of GENESIS_AGENTS) {
    console.log(`Minting ${agent.name} (${agent.personality})...`);

    try {
      // Call mint function
      const hash = await client.writeContract({
        address: AGENT_INFT_CONTRACT as `0x${string}`,
        abi: AGENT_INFT_ABI,
        functionName: "mint",
        args: [
          account.address, // to
          `ipfs://QmGenesis${agent.name.toUpperCase()}`, // weightCID (placeholder)
          `ipfs://QmMetadata${agent.name.toUpperCase()}`, // metadataCID (placeholder)
          0n, // parentA (0 = genesis)
          0n, // parentB (0 = genesis)
          agent.sealedKeyHash as `0x${string}`,
        ],
      });

      console.log(`  Tx: ${hash}`);

      // Wait for confirmation
      const receipt = await client.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        // Extract tokenId from logs (emitted by mint)
        const log = receipt.logs[0];
        const tokenId =
          log && log.topics[3] ? BigInt(log.topics[3]).toString() : "unknown";

        results.push({
          name: agent.name,
          tokenId,
          txHash: hash,
        });

        console.log(`  ✓ Minted ${agent.name} (TokenID: ${tokenId})\n`);
      } else {
        console.log(`  ✗ Transaction failed\n`);
      }
    } catch (error) {
      console.error(`  ✗ Error minting ${agent.name}:`, error);
      console.log();
    }
  }

  // Summary
  console.log("\n========================================");
  console.log("Genesis Agent Seeding Summary");
  console.log("========================================\n");

  if (results.length > 0) {
    console.log("Successfully minted agents:\n");
    results.forEach((r) => {
      console.log(`${r.name}`);
      console.log(`  TokenID: ${r.tokenId}`);
      console.log(`  Tx: ${r.txHash}`);
      console.log();
    });
  } else {
    console.log("No agents were successfully minted.");
  }

  console.log(`Total: ${results.length}/${GENESIS_AGENTS.length} agents minted`);
}

// Run
seedAgents().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
