/**
 * Breeding merger: poll BreedRequested events, fetch parents, merge, upload, submit onchain.
 */
import { randomBytes } from "node:crypto";
import { keccak256, encodeAbiParameters, parseAbiParameters, parseAbiItem, type Hex } from "viem";

const BREED_REQUESTED_EVENT = parseAbiItem(
  "event BreedRequested(uint256 indexed reqId, uint256 indexed parentA, uint256 indexed parentB, address requester, uint256 fee, uint96 royaltyBpsToParents)"
);
import { ethers } from "ethers";
import { getConfig } from "../config.js";
import { logger } from "../logger.js";
import {
  getPublicClient,
  getBreedingMarketAddress,
  getAgentINFTAddress,
  AGENT_INFT_ABI,
  encodeFulfillBreed,
} from "../onchain/contracts.js";
import { downloadDecrypted, uploadEncrypted } from "../storage/zgStorage.js";
import { fineTuneMerge } from "../compute/zgCompute.js";
import { executeTx } from "../onchain/keeperhub.js";

let lastBlockPolled = BigInt(0);

export async function startBreedingMerger() {
  const config = getConfig();
  const publicClient = getPublicClient();

  const breedingTeeKey = process.env.BREEDING_TEE_KEY
    ? Buffer.from(process.env.BREEDING_TEE_KEY, "hex")
    : Buffer.alloc(32);

  if (breedingTeeKey.length !== 32) {
    throw new Error(
      "NOT_IMPLEMENTED: BREEDING_TEE_KEY env var must be 32 bytes hex (64 chars)"
    );
  }

  logger.info("Starting breeding merger, polling for BreedRequested events");

  // Poll for BreedRequested events
  while (true) {
    try {
      const currentBlock = await publicClient.getBlockNumber();
      const fromBlock = lastBlockPolled > BigInt(0) ? lastBlockPolled + BigInt(1) : currentBlock - BigInt(100);
      const toBlock = currentBlock;

      if (fromBlock <= toBlock) {
        const logs = await publicClient.getLogs({
          address: getBreedingMarketAddress(),
          event: BREED_REQUESTED_EVENT,
          fromBlock,
          toBlock,
        });

        for (const log of logs) {
          try {
            await handleBreedRequested(log, config, breedingTeeKey);
          } catch (err) {
            logger.error({ err, log }, "Error handling BreedRequested");
          }
        }

        lastBlockPolled = toBlock;
      }

      // Poll every 30 seconds
      await new Promise((r) => setTimeout(r, 30_000));
    } catch (err) {
      logger.warn({ err }, "Error in breeding merger poll loop");
      // Continue polling
      await new Promise((r) => setTimeout(r, 10_000));
    }
  }
}

async function handleBreedRequested(
  log: any,
  config: ReturnType<typeof getConfig>,
  breedingTeeKey: Buffer
) {
  const publicClient = getPublicClient();
  const agentINFTAddr = getAgentINFTAddress();
  const breedingMarketAddr = getBreedingMarketAddress();

  const args = log.args as any;
  const reqId = args?.reqId ?? args?.[0];
  const parentA = args?.parentA ?? args?.[1];
  const parentB = args?.parentB ?? args?.[2];

  if (!reqId || !parentA || !parentB) {
    logger.warn({ log }, "BreedRequested event missing args");
    return;
  }

  logger.info({ reqId, parentA, parentB }, "BreedRequested event received");

  try {
    // Read parent weight CIDs from AgentINFT contract
    // @ts-ignore - viem API mismatch
    const parentACID = (await publicClient.readContract({
      address: agentINFTAddr,
      abi: AGENT_INFT_ABI,
      functionName: "getWeightCID",
      args: [BigInt(parentA)],
    })) as string;

    // @ts-ignore - viem API mismatch
    const parentBCID = (await publicClient.readContract({
      address: agentINFTAddr,
      abi: AGENT_INFT_ABI,
      functionName: "getWeightCID",
      args: [BigInt(parentB)],
    })) as string;

    logger.info({ parentACID, parentBCID }, "Parent weight CIDs fetched");

    // Download parent weights
    const parentABuffer = await downloadDecrypted(parentACID, new Uint8Array(breedingTeeKey));
    const parentBBuffer = await downloadDecrypted(parentBCID, new Uint8Array(breedingTeeKey));

    logger.info(
      { parentABytes: parentABuffer.length, parentBBytes: parentBBuffer.length },
      "Parent weights downloaded"
    );

    // Run fine-tune merge
    const mergeResult = await fineTuneMerge(parentACID, parentBCID);
    logger.info({ outputCID: mergeResult.outputCID }, "Fine-tune merge complete");

    // Generate new encryption key and encrypt offspring
    const offspringKey = randomBytes(32);
    const offspringBuffer = Buffer.concat([parentABuffer, parentBBuffer]); // Simplified merge

    const uploadResult = await uploadEncrypted(offspringBuffer, new Uint8Array(offspringKey));
    logger.info({ cid: uploadResult.cid }, "Offspring weights uploaded");

    // Compute sealed key hash
    const sealedKeyHash = keccak256(offspringKey);

    // Sign breeding result with ECDSA operator key
    const provider = new ethers.JsonRpcProvider(config.ZG_RPC_URL);
    const signer = new ethers.Wallet(config.AGENT_OPERATOR_KEY, provider);

    const messageHash = keccak256(
      encodeAbiParameters(
        parseAbiParameters("uint256 parentA, uint256 parentB, string offspringCID, bytes32 sealedKeyHash"),
        [BigInt(parentA), BigInt(parentB), uploadResult.cid, sealedKeyHash as Hex]
      )
    );

    const sig = await signer.signMessage(messageHash);

    // Submit fulfillBreed onchain via KeeperHub
    const calldata = encodeFulfillBreed({
      reqId: BigInt(reqId),
      offspringWeightCID: uploadResult.cid,
      metadataCID: mergeResult.outputCID,
      sealedKeyHash: sealedKeyHash as Hex,
      operatorSig: sig as Hex,
    });

    const result = await executeTx(breedingMarketAddr, calldata, BigInt(0));

    logger.info(
      { reqId, txHash: result.transactionHash, offspringCID: uploadResult.cid },
      "Breeding fulfillment submitted"
    );
  } catch (err) {
    logger.error({ err, reqId }, "Error in handleBreedRequested");
    throw err;
  }
}
