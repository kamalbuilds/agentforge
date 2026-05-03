import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { logger } from "./lib/logger.js";
import { getConfig } from "./config.js";

// Import routes
import ccipRouter from "./routes/ccip.js";
import storageRouter from "./routes/storage.js";
import keeperhubRouter from "./routes/keeperhub.js";
import uniswapRouter from "./routes/uniswap.js";
import arenaRouter from "./routes/arena.js";

const app = new Hono();

// Middleware
app.use(
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ ok: true, timestamp: new Date().toISOString() });
});

// Mount routes
app.route("/ccip", ccipRouter);
app.route("/storage", storageRouter);
app.route("/keeperhub", keeperhubRouter);
app.route("/uniswap", uniswapRouter);
app.route("/arena", arenaRouter);

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

// Error handler
app.onError((error, c) => {
  logger.error({ error }, "Unhandled error");
  return c.json(
    {
      error:
        error instanceof Error ? error.message : "Internal server error",
    },
    500
  );
});

// Start server
const config = getConfig();

const server = serve(
  {
    fetch: app.fetch,
    port: config.PORT,
    hostname: "0.0.0.0",
  },
  (info) => {
    logger.info(
      { port: info.port, env: config.NODE_ENV },
      `AgentForge Gateway listening on http://localhost:${info.port}`
    );
  }
);

// Graceful shutdown
process.on("SIGINT", () => {
  logger.info("Shutting down gracefully");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("Shutting down gracefully");
  process.exit(0);
});

export default server;
