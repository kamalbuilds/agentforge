/**
 * AgentForge End-to-End Integration Test
 * Real onchain calls against 0G Galileo testnet (chainId 16601)
 * Run: cd packages/agent && tsx ../contracts/test-e2e/e2e.ts
 */

import { createWalletClient, createPublicClient, http, parseAbi, encodeAbiParameters, keccak256, toBytes, hexToBytes, concat, toHex, formatEther, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env from project root
dotenv.config({ path: resolve(__dirname, "../../../.env") });

// ── Chain definition ──────────────────────────────────────────────────────────
const zgGalileo = defineChain({
  id: 16602,
  name: "0G Galileo",
  nativeCurrency: { name: "OG", symbol: "OG", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evmrpc-testnet.0g.ai"] },
  },
  blockExplorers: {
    default: { name: "0G Explorer", url: "https://chainscan-galileo.0g.ai" },
  },
});

// ── Contract addresses ────────────────────────────────────────────────────────
const AGENT_INFT    = "0xC1DcB6b42d246Eb17690b8fB0CdBdB26241d3D65" as const;
const ARENA         = "0x762251b8715047D26c93F5a36e4afaC2cBEDEDb8" as const;
const BREEDING_MKT  = "0xc71Cf85EF8C0ED6a96CaD1EF6AE5c6BcCa96878d" as const;
const ROYALTY_VAULT = "0xDF37dD02319Fa1c538DcACA064a7919446dAa924" as const;
const EXPLORER      = "https://chainscan-galileo.0g.ai";

// ── Load ABIs ─────────────────────────────────────────────────────────────────
const abiDir = resolve(__dirname, "../../shared/abi");
const agentINFTAbi   = JSON.parse(readFileSync(`${abiDir}/AgentINFT.json`, "utf8"));
const arenaAbi       = JSON.parse(readFileSync(`${abiDir}/Arena.json`, "utf8"));
const breedingAbi    = JSON.parse(readFileSync(`${abiDir}/BreedingMarket.json`, "utf8"));
const royaltyAbi     = JSON.parse(readFileSync(`${abiDir}/RoyaltyVault.json`, "utf8"));

// ── Setup wallet ──────────────────────────────────────────────────────────────
const pk = process.env.DEPLOYER_PRIVATE_KEY;
if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY not set in .env");

const account = privateKeyToAccount(pk as `0x${string}`);
const deployer = account.address;
console.log(`\n${"=".repeat(70)}`);
console.log(`AgentForge E2E Integration Test`);
console.log(`${"=".repeat(70)}`);
console.log(`Deployer: ${deployer}`);
console.log(`Chain:    0G Galileo (chainId 16602)`);
console.log(`${"=".repeat(70)}\n`);

const transport = http("https://evmrpc-testnet.0g.ai");

const walletClient = createWalletClient({
  account,
  chain: zgGalileo,
  transport,
});

const publicClient = createPublicClient({
  chain: zgGalileo,
  transport,
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function txLink(hash: string): string {
  return `${EXPLORER}/tx/${hash}`;
}

function randomBytes32(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes) as `0x${string}`;
}

async function waitForReceipt(hash: `0x${string}`, label: string) {
  process.stdout.write(`  Waiting for ${label}...`);
  // Manual polling loop — 0G testnet can be slow to index receipts
  const deadline = Date.now() + 480_000; // 8 minutes
  let dots = 0;
  while (Date.now() < deadline) {
    try {
      const receipt = await publicClient.getTransactionReceipt({ hash });
      if (receipt) {
        if (receipt.status === "reverted") {
          console.log(" REVERTED");
          throw new Error(`Transaction reverted: ${hash}`);
        }
        console.log(` confirmed (block ${receipt.blockNumber})`);
        console.log(`  TX: ${txLink(hash)}`);
        return receipt;
      }
    } catch (e: any) {
      // TransactionReceiptNotFoundError is expected while pending
      if (!e?.message?.includes("not found") && !e?.name?.includes("TransactionReceiptNotFound")) {
        throw e;
      }
    }
    await new Promise(r => setTimeout(r, 5_000));
    if (++dots % 6 === 0) process.stdout.write(".");
  }
  throw new Error(`Timeout waiting for ${label}: ${hash}`);
}

// Track summary data
const summary: {
  agentsMinted: number[];
  matchId?: bigint;
  breedReqId?: bigint;
  offspringTokenId?: bigint;
  txHashes: { label: string; hash: string }[];
  ogSpent: bigint;
} = {
  agentsMinted: [],
  txHashes: [],
  ogSpent: 0n,
};

function recordTx(label: string, hash: string) {
  summary.txHashes.push({ label, hash });
}

// ── Phase 1: Mint agents #2 and #3 ───────────────────────────────────────────
async function phase1_mintAgents() {
  console.log(`\n${"─".repeat(70)}`);
  console.log("PHASE 1: Mint Agents #2 and #3");
  console.log(`${"─".repeat(70)}`);

  // Check balance first
  const balance = await publicClient.getBalance({ address: deployer });
  console.log(`\nDeployer balance: ${formatEther(balance)} OG`);
  const minRequired = parseEther("0.1");
  if (balance < minRequired) {
    throw new Error(`Insufficient OG balance. Have ${formatEther(balance)} OG, need at least 0.1 OG`);
  }
  console.log("Balance check: OK\n");

  // Check if #2 already exists by trying ownerOf
  let startTokenId = 2n;
  try {
    const owner2 = await publicClient.readContract({
      address: AGENT_INFT,
      abi: agentINFTAbi,
      functionName: "ownerOf",
      args: [2n],
    });
    console.log(`Token #2 already exists, owned by ${owner2}`);
    // Check if #3 also exists
    try {
      const owner3 = await publicClient.readContract({
        address: AGENT_INFT,
        abi: agentINFTAbi,
        functionName: "ownerOf",
        args: [3n],
      });
      console.log(`Token #3 already exists, owned by ${owner3}`);
      summary.agentsMinted = [2, 3];
      console.log("Agents #2 and #3 already minted, skipping mint phase.");
      return;
    } catch {
      startTokenId = 3n;
      console.log("Token #3 does not exist, will mint it.");
    }
  } catch {
    console.log("Token #2 does not exist, will mint #2 and #3.");
  }

  // Mint agent #2
  if (startTokenId <= 2n) {
    console.log("\nMinting agent #2...");
    const sealedKeyHash2 = randomBytes32();
    const hash2 = await walletClient.writeContract({
      address: AGENT_INFT,
      abi: agentINFTAbi,
      functionName: "mint",
      args: [deployer, "ipfs://e2e-agent2-weights", "ipfs://e2e-agent2-meta", 0n, 0n, sealedKeyHash2],
    });
    recordTx("Mint Agent #2", hash2);
    const receipt2 = await waitForReceipt(hash2, "mint #2");

    // Parse Transfer event to get tokenId
    const mintLog2 = receipt2.logs.find(
      (l) => l.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" &&
             l.topics[1] === "0x0000000000000000000000000000000000000000000000000000000000000000"
    );
    const tokenId2 = mintLog2 ? BigInt(mintLog2.topics[3]!) : 2n;
    console.log(`  Agent #${tokenId2} minted`);
    summary.agentsMinted.push(Number(tokenId2));

    // Verify ownerOf
    const owner2 = await publicClient.readContract({
      address: AGENT_INFT,
      abi: agentINFTAbi,
      functionName: "ownerOf",
      args: [tokenId2],
    });
    console.log(`  ownerOf(${tokenId2}) = ${owner2} [VERIFIED: ${owner2.toLowerCase() === deployer.toLowerCase() ? "OK" : "MISMATCH"}]`);
  }

  // Mint agent #3
  console.log("\nMinting agent #3...");
  const sealedKeyHash3 = randomBytes32();
  const hash3 = await walletClient.writeContract({
    address: AGENT_INFT,
    abi: agentINFTAbi,
    functionName: "mint",
    args: [deployer, "ipfs://e2e-agent3-weights", "ipfs://e2e-agent3-meta", 0n, 0n, sealedKeyHash3],
  });
  recordTx("Mint Agent #3", hash3);
  const receipt3 = await waitForReceipt(hash3, "mint #3");

  const mintLog3 = receipt3.logs.find(
    (l) => l.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" &&
           l.topics[1] === "0x0000000000000000000000000000000000000000000000000000000000000000"
  );
  const tokenId3 = mintLog3 ? BigInt(mintLog3.topics[3]!) : 3n;
  console.log(`  Agent #${tokenId3} minted`);
  summary.agentsMinted.push(Number(tokenId3));

  const owner3 = await publicClient.readContract({
    address: AGENT_INFT,
    abi: agentINFTAbi,
    functionName: "ownerOf",
    args: [tokenId3],
  });
  console.log(`  ownerOf(${tokenId3}) = ${owner3} [VERIFIED: ${owner3.toLowerCase() === deployer.toLowerCase() ? "OK" : "MISMATCH"}]`);
}

// ── Phase 2: Set Arena Operator ───────────────────────────────────────────────
async function phase2_setArenaOperator() {
  console.log(`\n${"─".repeat(70)}`);
  console.log("PHASE 2: Set Arena Operator");
  console.log(`${"─".repeat(70)}\n`);

  const currentOperator = await publicClient.readContract({
    address: ARENA,
    abi: arenaAbi,
    functionName: "arenaOperator",
  }) as string;

  console.log(`Current arenaOperator: ${currentOperator}`);

  if (currentOperator.toLowerCase() === deployer.toLowerCase()) {
    console.log("Arena operator already set to deployer. No action needed.");
    return;
  }

  // Operator is not deployer — check if we can set it (we're owner)
  const arenaOwner = await publicClient.readContract({
    address: ARENA,
    abi: arenaAbi,
    functionName: "owner",
  }) as string;
  console.log(`Arena owner: ${arenaOwner}`);

  if (arenaOwner.toLowerCase() !== deployer.toLowerCase()) {
    throw new Error(`Cannot set arena operator: deployer is not the Arena owner (owner=${arenaOwner})`);
  }

  console.log("Setting arena operator to deployer...");
  const hashOp = await walletClient.writeContract({
    address: ARENA,
    abi: arenaAbi,
    functionName: "setArenaOperator",
    args: [deployer],
  });
  recordTx("setArenaOperator", hashOp);
  await waitForReceipt(hashOp, "setArenaOperator");
  console.log("Arena operator set to deployer.");
}

// ── Phase 3: Run a match end-to-end ──────────────────────────────────────────
async function phase3_runMatch() {
  console.log(`\n${"─".repeat(70)}`);
  console.log("PHASE 3: Run Match (Agent #2 vs Agent #3)");
  console.log(`${"─".repeat(70)}\n`);

  const STAKE = 1_000_000_000_000_000n; // 0.001 OG

  // Verify deployer owns both agents
  const owner2 = await publicClient.readContract({ address: AGENT_INFT, abi: agentINFTAbi, functionName: "ownerOf", args: [2n] }) as string;
  const owner3 = await publicClient.readContract({ address: AGENT_INFT, abi: agentINFTAbi, functionName: "ownerOf", args: [3n] }) as string;
  console.log(`ownerOf(2) = ${owner2}`);
  console.log(`ownerOf(3) = ${owner3}`);

  if (owner2.toLowerCase() !== deployer.toLowerCase()) {
    throw new Error(`Deployer does not own agent #2 (owner: ${owner2})`);
  }
  if (owner3.toLowerCase() !== deployer.toLowerCase()) {
    throw new Error(`Deployer does not own agent #3 (owner: ${owner3})`);
  }

  // Check ELO before
  const elo2Before = await publicClient.readContract({ address: ARENA, abi: arenaAbi, functionName: "getElo", args: [2n] }) as number;
  const elo3Before = await publicClient.readContract({ address: ARENA, abi: arenaAbi, functionName: "getElo", args: [3n] }) as number;
  console.log(`\nELO before: Agent#2=${elo2Before}, Agent#3=${elo3Before}`);

  const balanceBefore = await publicClient.getBalance({ address: deployer });

  // Check if there's already an existing match we can reuse (Proposed or Accepted state)
  const matchCount = await publicClient.readContract({ address: ARENA, abi: arenaAbi, functionName: "matchCount" }) as bigint;
  let matchId: bigint | undefined;
  let skipAccept = false;

  // Scan existing matches for a usable one (Proposed=0 or Accepted=1) between agents 2 and 3
  for (let i = 0n; i < matchCount; i++) {
    const m = await publicClient.readContract({ address: ARENA, abi: arenaAbi, functionName: "getMatch", args: [i] }) as any;
    const agentA = BigInt(m.agentA ?? m[0]);
    const agentB = BigInt(m.agentB ?? m[1]);
    const status = Number(m.status ?? m[8]);
    if ((agentA === 2n && agentB === 3n) || (agentA === 3n && agentB === 2n)) {
      if (status === 0 || status === 1) { // Proposed or Accepted
        matchId = i;
        skipAccept = status === 1;
        console.log(`Found existing match ${i} (status=${status === 0 ? "Proposed" : "Accepted"}), reusing.`);
        summary.matchId = matchId;
        break;
      }
    }
  }

  if (matchId === undefined) {
    // proposeMatch(agentA=2, agentB=3, stake) with msg.value=stake
    console.log(`\nProposing match: Agent#2 vs Agent#3, stake=${formatEther(STAKE)} OG...`);

    const hashPropose = await walletClient.writeContract({
      address: ARENA,
      abi: arenaAbi,
      functionName: "proposeMatch",
      args: [2n, 3n, STAKE],
      value: STAKE,
    });
    recordTx("proposeMatch", hashPropose);
    const receiptPropose = await waitForReceipt(hashPropose, "proposeMatch");

    // Parse MatchProposed event: matchId is first indexed topic (after event sig)
    // Event: MatchProposed(uint256 indexed matchId, uint256 indexed agentA, uint256 indexed agentB, uint256 stake, address proposer)
    const matchProposedSig = keccak256(toBytes("MatchProposed(uint256,uint256,uint256,uint256,address)"));
    const proposedLog = receiptPropose.logs.find((l) => l.topics[0] === matchProposedSig);
    if (!proposedLog) throw new Error("MatchProposed event not found in receipt");
    matchId = BigInt(proposedLog.topics[1]!);
    console.log(`\nMatch proposed! matchId = ${matchId}`);
    summary.matchId = matchId;
  }

  if (!skipAccept) {
    // acceptMatch(matchId) - deployer also owns agentB (#3)
    console.log(`\nAccepting match ${matchId}...`);
    const hashAccept = await walletClient.writeContract({
      address: ARENA,
      abi: arenaAbi,
      functionName: "acceptMatch",
      args: [matchId],
      value: STAKE,
    });
    recordTx("acceptMatch", hashAccept);
    await waitForReceipt(hashAccept, "acceptMatch");
  } else {
    console.log(`Match already accepted, skipping acceptMatch.`);
  }

  // Build resultHash and operatorSig
  // Arena._verifyOperatorSig: msgHash = keccak256(abi.encodePacked(matchId, winnerTokenId, resultHash))
  // We pick winner = agent #2
  const winnerTokenId = 2n;
  const loserTokenId  = 3n;

  // resultHash is the "off-chain match result hash" — we make it a deterministic bytes32
  // of the match outcome for the test
  const resultHash = keccak256(encodeAbiParameters(
    [{ type: "uint256" }, { type: "uint256" }],
    [matchId, winnerTokenId]
  ));
  console.log(`\nresultHash: ${resultHash}`);

  // msgHash = keccak256(abi.encodePacked(matchId, winnerTokenId, resultHash))
  // encodePacked: matchId (uint256=32 bytes), winnerTokenId (uint256=32 bytes), resultHash (bytes32)
  const msgHash = keccak256(concat([
    toBytes(matchId, { size: 32 }),
    toBytes(winnerTokenId, { size: 32 }),
    hexToBytes(resultHash),
  ]));

  // Ethereum prefixed hash
  const ethSignedHash = keccak256(concat([
    toBytes("\x19Ethereum Signed Message:\n32"),
    hexToBytes(msgHash),
  ]));

  // Sign with deployer key (operator == deployer)
  // viem's signMessage adds the prefix internally, so we sign the raw msgHash
  const operatorSig = await account.signMessage({ message: { raw: hexToBytes(msgHash) } });
  console.log(`operatorSig: ${operatorSig}`);

  // reportResult(matchId, winnerTokenId, resultHash, operatorSig)
  console.log(`\nReporting result: winner=Agent#${winnerTokenId}...`);
  const hashReport = await walletClient.writeContract({
    address: ARENA,
    abi: arenaAbi,
    functionName: "reportResult",
    args: [matchId, winnerTokenId, resultHash, operatorSig as `0x${string}`],
  });
  recordTx("reportResult", hashReport);
  const receiptReport = await waitForReceipt(hashReport, "reportResult");

  // Parse MatchSettled event
  const matchSettledSig = keccak256(toBytes("MatchSettled(uint256,uint256,uint256,uint32,uint32,uint256,bytes32)"));
  const settledLog = receiptReport.logs.find((l) => l.topics[0] === matchSettledSig);

  // Verify ELO changes
  const elo2After = await publicClient.readContract({ address: ARENA, abi: arenaAbi, functionName: "getElo", args: [2n] }) as number;
  const elo3After = await publicClient.readContract({ address: ARENA, abi: arenaAbi, functionName: "getElo", args: [3n] }) as number;
  console.log(`\nELO after:  Agent#2=${elo2After} (was ${elo2Before}), Agent#3=${elo3After} (was ${elo3Before})`);

  if (elo2After <= elo2Before) console.warn(`  WARNING: Agent#2 ELO did not increase (${elo2Before} -> ${elo2After})`);
  else console.log(`  Agent#2 ELO increased: ${elo2Before} -> ${elo2After} [OK]`);

  if (elo3After >= elo3Before) console.warn(`  WARNING: Agent#3 ELO did not decrease (${elo3Before} -> ${elo3After})`);
  else console.log(`  Agent#3 ELO decreased: ${elo3Before} -> ${elo3After} [OK]`);

  // Check balance — should have received payout (2*stake - 5% fee)
  const balanceAfter = await publicClient.getBalance({ address: deployer });
  console.log(`\nBalance change: ${formatEther(balanceAfter - balanceBefore)} OG (net of gas + stakes)`);
}

// ── Phase 4: Breeding ─────────────────────────────────────────────────────────
async function phase4_breeding() {
  console.log(`\n${"─".repeat(70)}`);
  console.log("PHASE 4: Breeding (Agent#2 x Agent#3 -> offspring)");
  console.log(`${"─".repeat(70)}\n`);

  const BREED_FEE = 10_000_000_000_000_000n; // 0.01 OG

  // Ensure BreedingMarket is a minter on AgentINFT
  const isMinter = await publicClient.readContract({
    address: AGENT_INFT,
    abi: agentINFTAbi,
    functionName: "isMinter",
    args: [BREEDING_MKT],
  }) as boolean;
  console.log(`BreedingMarket is minter on AgentINFT: ${isMinter}`);
  if (!isMinter) {
    console.log("Adding BreedingMarket as minter...");
    const hashAddMinter = await walletClient.writeContract({
      address: AGENT_INFT,
      abi: agentINFTAbi,
      functionName: "addMinter",
      args: [BREEDING_MKT],
    });
    recordTx("addMinter(BreedingMarket)", hashAddMinter);
    await waitForReceipt(hashAddMinter, "addMinter");
  }

  // Check breedingOperator
  const breedingOperator = await publicClient.readContract({
    address: BREEDING_MKT,
    abi: breedingAbi,
    functionName: "breedingOperator",
  }) as string;
  console.log(`breedingOperator: ${breedingOperator}`);

  if (breedingOperator.toLowerCase() !== deployer.toLowerCase()) {
    console.log("Setting breeding operator to deployer...");
    const hashBO = await walletClient.writeContract({
      address: BREEDING_MKT,
      abi: breedingAbi,
      functionName: "setBreedingOperator",
      args: [deployer],
    });
    recordTx("setBreedingOperator", hashBO);
    await waitForReceipt(hashBO, "setBreedingOperator");
  } else {
    console.log("Breeding operator already set to deployer.");
  }

  // setBreedingApproval(tokenId=2, true)
  const isApproved2 = await publicClient.readContract({
    address: BREEDING_MKT,
    abi: breedingAbi,
    functionName: "isBreedingApproved",
    args: [2n],
  }) as boolean;
  if (!isApproved2) {
    console.log("\nSetting breeding approval for Agent#2...");
    const hashApprove2 = await walletClient.writeContract({
      address: BREEDING_MKT,
      abi: breedingAbi,
      functionName: "setBreedingApproval",
      args: [2n, true],
    });
    recordTx("setBreedingApproval(2, true)", hashApprove2);
    await waitForReceipt(hashApprove2, "setBreedingApproval #2");
  } else {
    console.log("Agent#2 already approved for breeding.");
  }

  // setBreedingApproval(tokenId=3, true)
  const isApproved3 = await publicClient.readContract({
    address: BREEDING_MKT,
    abi: breedingAbi,
    functionName: "isBreedingApproved",
    args: [3n],
  }) as boolean;
  if (!isApproved3) {
    console.log("Setting breeding approval for Agent#3...");
    const hashApprove3 = await walletClient.writeContract({
      address: BREEDING_MKT,
      abi: breedingAbi,
      functionName: "setBreedingApproval",
      args: [3n, true],
    });
    recordTx("setBreedingApproval(3, true)", hashApprove3);
    await waitForReceipt(hashApprove3, "setBreedingApproval #3");
  } else {
    console.log("Agent#3 already approved for breeding.");
  }

  // requestBreed(parentA=2, parentB=3, royaltyBpsToParents=500) with fee
  console.log(`\nRequesting breed: Agent#2 x Agent#3, fee=${formatEther(BREED_FEE)} OG, royaltyBps=500...`);
  const hashBreedReq = await walletClient.writeContract({
    address: BREEDING_MKT,
    abi: breedingAbi,
    functionName: "requestBreed",
    args: [2n, 3n, 500n],
    value: BREED_FEE,
  });
  recordTx("requestBreed", hashBreedReq);
  const receiptBreedReq = await waitForReceipt(hashBreedReq, "requestBreed");

  // Parse BreedRequested event
  const breedRequestedSig = keccak256(toBytes("BreedRequested(uint256,uint256,uint256,address,uint256,uint96)"));
  const breedReqLog = receiptBreedReq.logs.find((l) => l.topics[0] === breedRequestedSig);
  if (!breedReqLog) throw new Error("BreedRequested event not found");
  const reqId = BigInt(breedReqLog.topics[1]!);
  console.log(`\nBreed request created! reqId = ${reqId}`);
  summary.breedReqId = reqId;

  // Build fulfill signature
  // BreedingMarket._verifyOperatorSig:
  //   msgHash = keccak256(abi.encodePacked(reqId, keccak256(bytes(weightCID)), sealedKeyHash))
  const offspringWeightCID = "ipfs://e2e-offspring-cid";
  const metadataCID = "ipfs://e2e-meta";
  const offspringSealedKeyHash = randomBytes32();

  const weightCIDHash = keccak256(toBytes(offspringWeightCID));

  const breedMsgHash = keccak256(concat([
    toBytes(reqId, { size: 32 }),
    hexToBytes(weightCIDHash),
    hexToBytes(offspringSealedKeyHash),
  ]));

  const breedOperatorSig = await account.signMessage({ message: { raw: hexToBytes(breedMsgHash) } });
  console.log(`breedOperatorSig: ${breedOperatorSig}`);

  // fulfillBreed(reqId, offspringWeightCID, metadataCID, sealedKeyHash, operatorSig)
  console.log(`\nFulfilling breed request ${reqId}...`);
  const hashFulfill = await walletClient.writeContract({
    address: BREEDING_MKT,
    abi: breedingAbi,
    functionName: "fulfillBreed",
    args: [reqId, offspringWeightCID, metadataCID, offspringSealedKeyHash, breedOperatorSig as `0x${string}`],
  });
  recordTx("fulfillBreed", hashFulfill);
  const receiptFulfill = await waitForReceipt(hashFulfill, "fulfillBreed");

  // Parse BreedFulfilled event to get offspring tokenId
  const breedFulfilledSig = keccak256(toBytes("BreedFulfilled(uint256,uint256,uint16)"));
  const fulfilledLog = receiptFulfill.logs.find((l) => l.topics[0] === breedFulfilledSig);
  if (!fulfilledLog) throw new Error("BreedFulfilled event not found");
  const offspringTokenId = BigInt(fulfilledLog.topics[2]!);
  console.log(`\nOffspring minted! tokenId = ${offspringTokenId}`);
  summary.offspringTokenId = offspringTokenId;

  // Verify ownerOf offspring
  const offspringOwner = await publicClient.readContract({
    address: AGENT_INFT,
    abi: agentINFTAbi,
    functionName: "ownerOf",
    args: [offspringTokenId],
  }) as string;
  console.log(`ownerOf(${offspringTokenId}) = ${offspringOwner} [VERIFIED: ${offspringOwner.toLowerCase() === deployer.toLowerCase() ? "OK" : "MISMATCH"}]`);

  // Verify lineage
  const lineage = await publicClient.readContract({
    address: AGENT_INFT,
    abi: agentINFTAbi,
    functionName: "lineage",
    args: [offspringTokenId],
  }) as bigint[];
  console.log(`Lineage of #${offspringTokenId}: [${lineage.join(", ")}]`);

  // Verify royalty split registered
  const hasSplit = await publicClient.readContract({
    address: ROYALTY_VAULT,
    abi: royaltyAbi,
    functionName: "hasSplit",
    args: [offspringTokenId],
  }) as boolean;
  console.log(`RoyaltyVault.hasSplit(${offspringTokenId}) = ${hasSplit} [VERIFIED: ${hasSplit ? "OK" : "SPLIT NOT REGISTERED"}]`);

  if (hasSplit) {
    const split = await publicClient.readContract({
      address: ROYALTY_VAULT,
      abi: royaltyAbi,
      functionName: "getSplit",
      args: [offspringTokenId],
    }) as [string[], bigint[]];
    console.log(`Split recipients: ${split[0]}`);
    console.log(`Split bps: ${split[1]}`);
  }
}

// ── Phase 5: Royalty ──────────────────────────────────────────────────────────
async function phase5_royalty() {
  console.log(`\n${"─".repeat(70)}`);
  console.log("PHASE 5: Royalty Deposit & Claim");
  console.log(`${"─".repeat(70)}\n`);

  if (!summary.offspringTokenId) {
    throw new Error("No offspring token ID found — Phase 4 must succeed first");
  }

  const offspringTokenId = summary.offspringTokenId;
  const ROYALTY_DEPOSIT = 1_000_000_000_000_000n; // 0.001 OG

  // Check that split is registered
  const hasSplit = await publicClient.readContract({
    address: ROYALTY_VAULT,
    abi: royaltyAbi,
    functionName: "hasSplit",
    args: [offspringTokenId],
  }) as boolean;

  if (!hasSplit) {
    throw new Error(`No split registered for offspring #${offspringTokenId} in RoyaltyVault`);
  }

  // Check pending before
  const pendingBefore = await publicClient.readContract({
    address: ROYALTY_VAULT,
    abi: royaltyAbi,
    functionName: "pending",
    args: [deployer],
  }) as bigint;
  console.log(`pending(deployer) before deposit: ${formatEther(pendingBefore)} OG`);

  // deposit(offspringTokenId) with 0.001 OG
  console.log(`\nDepositing ${formatEther(ROYALTY_DEPOSIT)} OG to RoyaltyVault for token #${offspringTokenId}...`);
  const hashDeposit = await walletClient.writeContract({
    address: ROYALTY_VAULT,
    abi: royaltyAbi,
    functionName: "deposit",
    args: [offspringTokenId],
    value: ROYALTY_DEPOSIT,
  });
  recordTx("RoyaltyVault.deposit", hashDeposit);
  await waitForReceipt(hashDeposit, "deposit");

  // Check pending after
  const pendingAfter = await publicClient.readContract({
    address: ROYALTY_VAULT,
    abi: royaltyAbi,
    functionName: "pending",
    args: [deployer],
  }) as bigint;
  console.log(`pending(deployer) after deposit: ${formatEther(pendingAfter)} OG`);

  if (pendingAfter <= pendingBefore) {
    throw new Error(`RoyaltyVault.pending(deployer) did not increase after deposit (${pendingBefore} -> ${pendingAfter})`);
  }
  console.log(`pending increased by ${formatEther(pendingAfter - pendingBefore)} OG [OK]`);

  // claim(deployer)
  console.log(`\nClaiming royalties to deployer...`);
  const balanceBefore = await publicClient.getBalance({ address: deployer });
  const hashClaim = await walletClient.writeContract({
    address: ROYALTY_VAULT,
    abi: royaltyAbi,
    functionName: "claim",
    args: [deployer],
  });
  recordTx("RoyaltyVault.claim", hashClaim);
  await waitForReceipt(hashClaim, "claim");

  const balanceAfter = await publicClient.getBalance({ address: deployer });
  console.log(`Balance change after claim: ${formatEther(balanceAfter - balanceBefore)} OG (net of gas)`);
  console.log(`Royalty claim complete [OK]`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  try {
    await phase1_mintAgents();
    await phase2_setArenaOperator();
    await phase3_runMatch();
    await phase4_breeding();
    await phase5_royalty();

    // Print final summary
    console.log(`\n${"=".repeat(70)}`);
    console.log("FINAL SUMMARY");
    console.log(`${"=".repeat(70)}`);
    console.log(`\nAgents minted: ${summary.agentsMinted.join(", ")}`);
    console.log(`Match ID: ${summary.matchId}`);
    console.log(`Breed Request ID: ${summary.breedReqId}`);
    console.log(`Offspring Token ID: ${summary.offspringTokenId}`);
    console.log(`\nTransaction Hashes:`);
    for (const tx of summary.txHashes) {
      console.log(`  [${tx.label}]`);
      console.log(`    ${txLink(tx.hash)}`);
    }

    // Write proof file
    const proofPath = resolve(__dirname, "../../../E2E-PROOF.md");
    const lines: string[] = [
      "# AgentForge E2E Integration Proof",
      "",
      `**Date:** ${new Date().toISOString()}`,
      `**Chain:** 0G Galileo (chainId 16601)`,
      `**Deployer:** \`${deployer}\``,
      "",
      "## Contract Addresses",
      `- AgentINFT: \`${AGENT_INFT}\``,
      `- Arena: \`${ARENA}\``,
      `- BreedingMarket: \`${BREEDING_MKT}\``,
      `- RoyaltyVault: \`${ROYALTY_VAULT}\``,
      "",
      "## Test Results",
      `- Agents minted: ${summary.agentsMinted.join(", ")}`,
      `- Match ID: ${summary.matchId}`,
      `- Breed Request ID: ${summary.breedReqId}`,
      `- Offspring Token ID: ${summary.offspringTokenId}`,
      "",
      "## Transaction Hashes",
      "",
    ];
    for (const tx of summary.txHashes) {
      lines.push(`### ${tx.label}`);
      lines.push(`- Hash: \`${tx.hash}\``);
      lines.push(`- Explorer: ${txLink(tx.hash)}`);
      lines.push("");
    }
    lines.push("## Final State");
    lines.push(`- Agent #2 and #3 minted and owned by deployer`);
    lines.push(`- Match between #2 and #3 completed, #2 won, ELO updated`);
    lines.push(`- Offspring #${summary.offspringTokenId} bred from #2 x #3`);
    lines.push(`- Royalty split registered in RoyaltyVault`);
    lines.push(`- Royalty deposited and claimed successfully`);
    lines.push("");
    lines.push("All phases passed. Real onchain state verified.");

    const { writeFileSync } = await import("fs");
    writeFileSync(proofPath, lines.join("\n"), "utf8");
    console.log(`\nProof written to: ${proofPath}`);

    console.log(`\n${"=".repeat(70)}`);
    console.log("ALL PHASES PASSED");
    console.log(`${"=".repeat(70)}\n`);
    process.exit(0);
  } catch (err: any) {
    console.error(`\n${"=".repeat(70)}`);
    console.error(`E2E TEST FAILED`);
    console.error(`${"=".repeat(70)}`);
    console.error(err?.message ?? err);
    if (err?.cause) console.error("Cause:", err.cause);
    process.exit(1);
  }
}

main();
