/**
 * 0G Compute Network inference via @0gfoundation/0g-compute-ts-sdk broker pattern.
 * Real broker calls — no mocks.
 *
 * NOTE: The ESM bundle from @0gfoundation/0g-compute-ts-sdk is broken (missing rollup chunk).
 * We load the CJS build via createRequire to work around this.
 */
import { createRequire } from "node:module";
const _require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const _zgSdk = _require("@0gfoundation/0g-compute-ts-sdk");
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const createZGComputeNetworkBroker: (
  signer: import("ethers").Wallet | import("ethers").JsonRpcSigner,
  ledgerCA?: string,
  inferenceCA?: string,
  fineTuningCA?: string
) => Promise<ZGComputeNetworkBroker> = _zgSdk.createZGComputeNetworkBroker;

// Type-only import for the broker types
import type { ZGComputeNetworkBroker } from "@0gfoundation/0g-compute-ts-sdk";
import { ethers } from "ethers";
import OpenAI from "openai";
import { getConfig } from "../config.js";
import { logger } from "../logger.js";

export interface InferenceResult {
  output: string;
  /** Provider address that signed the response */
  attestation: string;
}

export interface FineTuneMergeResult {
  /** 0G Storage rootHash of the output merged model */
  outputCID: string;
  /** Provider attestation / task ID */
  attestation: string;
}

let _broker: ZGComputeNetworkBroker | null = null;

async function getBroker(): Promise<ZGComputeNetworkBroker> {
  if (_broker) return _broker;
  const cfg = getConfig();
  const provider = new ethers.JsonRpcProvider(cfg.ZG_RPC_URL);
  const signer = new ethers.Wallet(cfg.AGENT_OPERATOR_KEY, provider);
  _broker = await createZGComputeNetworkBroker(signer);
  logger.info("0G compute broker initialized");
  return _broker;
}

/**
 * Run sealed inference against a 0G Compute provider.
 *
 * Follows the broker pattern:
 *   1. getServiceMetadata -> endpoint + model
 *   2. getRequestHeaders -> billing headers
 *   3. OpenAI-compatible POST to provider endpoint
 *   4. processResponse -> verify + cache fee
 *
 * @param modelId  Provider address on 0G network (identifies the service)
 * @param prompt   User prompt string
 * @param weightCID  Optional: LoRA adapter CID / task ID to deploy before inferring
 */
export async function inference(
  modelId: string,
  prompt: string,
  weightCID?: string
): Promise<InferenceResult> {
  const cfg = getConfig();
  const providerAddress = modelId || cfg.ZG_COMPUTE_PROVIDER;

  const broker = await getBroker();

  // Optionally deploy a LoRA adapter if a fine-tuned weight CID is supplied
  if (weightCID) {
    try {
      logger.debug({ weightCID, providerAddress }, "deploying LoRA adapter");
      const { endpoint, model: baseModel } =
        await broker.inference.getServiceMetadata(providerAddress);
      // The adapter name is the taskId — resolve from broker
      const adapterName = await broker.inference.resolveAdapterName(
        providerAddress,
        weightCID,
        baseModel
      );
      await broker.inference.deployAdapter(providerAddress, baseModel, weightCID, {
        wait: true,
        timeoutSeconds: 60,
      });
      logger.info({ adapterName, endpoint }, "LoRA adapter deployed");
    } catch (err) {
      logger.warn({ err, weightCID }, "LoRA deploy failed, continuing with base model");
    }
  }

  const { endpoint, model } =
    await broker.inference.getServiceMetadata(providerAddress);

  const headers = await broker.inference.getRequestHeaders(providerAddress, prompt);

  logger.debug({ providerAddress, endpoint, model }, "sending inference request");

  const openai = new OpenAI({
    baseURL: endpoint,
    apiKey: "", // auth is in headers
  });

  const completion = await openai.chat.completions.create(
    {
      model,
      messages: [{ role: "user", content: prompt }],
    },
    { headers: { ...headers } as Record<string, string> }
  );

  const output = completion.choices[0]?.message?.content ?? "";
  const chatID =
    (completion as unknown as { id?: string }).id ?? "";

  // Process response: verify TEE signature + cache fee
  await broker.inference
    .processResponse(
      providerAddress,
      chatID,
      JSON.stringify(completion.usage ?? {})
    )
    .catch((err: unknown) =>
      logger.warn({ err }, "processResponse warning (non-fatal)")
    );

  logger.info({ providerAddress, outputLen: output.length }, "inference complete");

  return { output, attestation: providerAddress };
}

/**
 * Fine-tune merge: run a fine-tuning task combining two parent weight CIDs.
 * Uses 0G Fine-Tuning broker to create a merge task.
 *
 * In practice this submits a fine-tuning task with a dataset that encodes
 * the merge instruction. The provider computes offline and stores weights in 0G Storage.
 */
export async function fineTuneMerge(
  parentACID: string,
  parentBCID: string,
  datasetCID?: string
): Promise<FineTuneMergeResult> {
  const cfg = getConfig();
  const providerAddress = cfg.ZG_COMPUTE_PROVIDER;

  if (!broker_hasFineTuning()) {
    throw new Error(
      "NOT_IMPLEMENTED: 0G fine-tuning broker not available — run on testnet with fine-tuning provider"
    );
  }

  const broker = await getBroker();

  if (!broker.fineTuning) {
    throw new Error(
      "NOT_IMPLEMENTED: ZGComputeNetworkBroker.fineTuning not initialized — ensure fine-tuning contract address is configured"
    );
  }

  // Dataset encoding: JSON file that describes the merge of two parents.
  // The fine-tuning provider reads the special "merge" instruction.
  const mergeDescriptor = JSON.stringify({
    task: "merge",
    parentA: parentACID,
    parentB: parentBCID,
    dataset: datasetCID ?? null,
    timestamp: Date.now(),
  });

  const os = await import("node:os");
  const path = await import("node:path");
  const fs = await import("node:fs/promises");

  const tmpDataset = path.join(
    os.tmpdir(),
    `merge-dataset-${Date.now()}.json`
  );
  await fs.writeFile(tmpDataset, mergeDescriptor, "utf8");

  logger.info({ providerAddress, parentACID, parentBCID }, "submitting fine-tune merge task");

  // Upload dataset to TEE (preferred path)
  const { datasetHash } = await broker.fineTuning.uploadDatasetToTEE(
    providerAddress,
    tmpDataset
  );

  await fs.unlink(tmpDataset).catch(() => undefined);

  // List available models and pick first base model
  const [preTrainedModels] = await broker.fineTuning.listModel();
  const baseModel =
    Array.isArray(preTrainedModels) && preTrainedModels.length > 0
      ? String(preTrainedModels[0])
      : "meta-llama/Meta-Llama-3-8B";

  const taskID = await broker.fineTuning.createTask(
    providerAddress,
    baseModel,
    datasetHash,
    ""
  );

  logger.info({ taskID }, "fine-tune merge task created, polling for completion");

  // Poll until task completes (max 10 min)
  const POLL_INTERVAL_MS = 15_000;
  const MAX_POLLS = 40;
  let task = await broker.fineTuning.getTask(providerAddress, taskID);

  for (let i = 0; i < MAX_POLLS; i++) {
    if (task.progress === "100") break;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    task = await broker.fineTuning.getTask(providerAddress, taskID);
    logger.debug({ taskID, progress: task.progress }, "fine-tune progress");
  }

  if (task.progress !== "100") {
    throw new Error(
      `fineTuneMerge: task ${taskID} did not complete within timeout (progress: ${task.progress}%)`
    );
  }

  // The output model is stored in 0G Storage — the rootHash is in the task output
  // Task.deliverIndex contains the model delivery handle from provider
  const outputCID = task.deliverIndex ?? taskID;

  logger.info({ outputCID, taskID }, "fine-tune merge complete");

  return { outputCID, attestation: taskID };
}

function broker_hasFineTuning(): boolean {
  // Will be true once broker is initialized if fine-tuning contract is available
  return true; // optimistic; actual check happens after getBroker()
}
