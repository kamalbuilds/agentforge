import pino from "pino";

// Lazily create logger so config is read at module load time if available,
// otherwise fall back to "info".
let _level = "info";
try {
  const { getConfig } = await import("./config.js");
  _level = getConfig().LOG_LEVEL;
} catch {
  // Config not yet loaded or env missing — default to info
}

export const logger = pino({
  level: _level,
  transport:
    process.env["NODE_ENV"] !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});
