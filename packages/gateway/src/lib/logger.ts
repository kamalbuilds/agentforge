import pino from "pino";

const pinoLogger = pino({
  level: process.env.LOG_LEVEL || "info",
});

export const logger = pinoLogger;
