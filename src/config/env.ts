import { z } from "zod";

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

const DEFAULT_DEV_CORS_ORIGIN = "http://localhost:5173";

const rawEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
  CORS_ORIGIN: z.string().trim().min(1).optional(),
});

export interface AppConfig {
  readonly nodeEnv: "development" | "test" | "production";
  readonly port: number;
  readonly logLevel: (typeof LOG_LEVELS)[number];
  readonly corsOrigins: readonly string[];
}

export class ConfigError extends Error {
  readonly invalidVariables: readonly string[];

  constructor(invalidVariables: readonly string[]) {
    super(`環境變數不合法或缺少：${invalidVariables.join(", ")}`);
    this.name = "ConfigError";
    this.invalidVariables = [...invalidVariables];
  }
}

function splitOrigins(rawOrigins: string): readonly string[] {
  return rawOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

/**
 * 錯誤訊息只列出變數名稱，不含變數值，避免機密外洩到日誌。
 */
export function loadConfig(source: Readonly<Record<string, string | undefined>>): AppConfig {
  const parsed = rawEnvSchema.safeParse(source);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => String(issue.path[0] ?? "unknown"));
    throw new ConfigError([...new Set(names)]);
  }

  const { NODE_ENV, PORT, LOG_LEVEL, CORS_ORIGIN } = parsed.data;
  if (NODE_ENV === "production" && CORS_ORIGIN === undefined) {
    throw new ConfigError(["CORS_ORIGIN"]);
  }

  return {
    nodeEnv: NODE_ENV,
    port: PORT,
    logLevel: LOG_LEVEL,
    corsOrigins: splitOrigins(CORS_ORIGIN ?? DEFAULT_DEV_CORS_ORIGIN),
  };
}
