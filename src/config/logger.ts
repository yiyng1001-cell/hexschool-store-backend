import { pino, type Logger } from "pino";
import type { AppConfig } from "./env.js";

export type AppLogger = Logger;

const REDACTED_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
  "*.password",
  "*.passwordHash",
  "*.accessToken",
];

export function createLogger(config: Pick<AppConfig, "logLevel">): AppLogger {
  return pino({
    level: config.logLevel,
    redact: { paths: REDACTED_PATHS, censor: "[REDACTED]" },
  });
}
