import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  AGENT_OPERATOR_KEY: z
    .string()
    .min(1, "AGENT_OPERATOR_KEY is required (hex private key)"),
  ZG_RPC_URL: z
    .string()
    .url("ZG_RPC_URL must be a valid URL")
    .default("https://evmrpc-testnet.0g.ai"),
  ZG_STORAGE_INDEXER: z
    .string()
    .url("ZG_STORAGE_INDEXER must be a valid URL"),
  ZG_COMPUTE_PROVIDER: z
    .string()
    .min(1, "ZG_COMPUTE_PROVIDER must be a provider address (0x...)"),
  AXL_NODE_URL: z
    .string()
    .url("AXL_NODE_URL must be a valid URL"),
  AGENT_TOKEN_ID: z
    .string()
    .transform((v) => BigInt(v))
    .pipe(z.bigint().nonnegative("AGENT_TOKEN_ID must be a non-negative integer")),
  KEEPERHUB_API_KEY: z
    .string()
    .startsWith("kh_", "KEEPERHUB_API_KEY must start with kh_"),
  KEEPERHUB_API_URL: z
    .string()
    .url("KEEPERHUB_API_URL must be a valid URL")
    .default("https://app.keeperhub.com/api"),
  UNISWAP_API_KEY: z
    .string()
    .optional(),
  BREEDING_OPERATOR: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),
});

export type Config = z.infer<typeof envSchema>;

let _config: Config | null = null;

export function getConfig(): Config {
  if (_config) return _config;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Config validation failed:\n${issues}`);
  }
  _config = result.data;
  return _config;
}
