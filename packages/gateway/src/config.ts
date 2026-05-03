import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().default("8787").pipe(z.coerce.number()),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // CCIP-Read signing
  CCIP_SIGNER_KEY: z.string().min(1, "CCIP_SIGNER_KEY is required"),

  // 0G Storage
  ZEROG_INDEXER_URL: z.string().url().default("http://localhost:6000"),

  // KeeperHub
  KEEPERHUB_API_KEY: z.string().min(1, "KEEPERHUB_API_KEY is required"),
  KEEPERHUB_BASE_URL: z.string().url().default("https://api.keeperhub.com"),

  // Uniswap
  UNISWAP_API_KEY: z.string().optional(),
  UNISWAP_BASE_URL: z.string().url().default("https://trade-api.gateway.uniswap.org"),

  // AXL Bridge
  AXL_NODE_URL: z.string().url().default("http://localhost:5000"),

  // RPC endpoints
  RPC_URL_0G: z.string().url().default("https://evmrpc-testnet.0g.ai"),
  RPC_URL_SEPOLIA: z.string().url().default("https://sepolia.infura.io/v3/YOUR_PROJECT_ID").optional(),
});

export type Config = z.infer<typeof envSchema>;

let config: Config | null = null;

export function getConfig(): Config {
  if (!config) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      const errorMessages = Object.entries(errors)
        .map(([field, msgs]) => `${field}: ${msgs?.join(", ")}`)
        .join("; ");
      throw new Error(`Invalid environment variables: ${errorMessages}`);
    }
    config = result.data;
  }
  return config;
}
