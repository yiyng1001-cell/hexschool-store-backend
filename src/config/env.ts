import { z } from "zod";

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

const DEFAULT_DEV_CORS_ORIGIN = "http://localhost:5173";
const MIN_JWT_SECRET_LENGTH = 32;
const PLACEHOLDER_SECRET_PREFIX = "change-me";
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

const SECONDS_PER_UNIT: Readonly<Record<string, number>> = { s: 1, m: 60, h: 3600, d: 86400 };
const DURATION_PATTERN = /^(\d+)([smhd])$/;

function durationToSeconds(duration: string): number {
  const match = DURATION_PATTERN.exec(duration);
  const amount = match?.[1];
  const secondsPerUnit = SECONDS_PER_UNIT[match?.[2] ?? ""];
  if (amount === undefined || secondsPerUnit === undefined) return Number.NaN;
  return Number(amount) * secondsPerUnit;
}

const durationSchema = z
  .string()
  .regex(DURATION_PATTERN, "格式須為數字加 s、m、h 或 d，例如 7d")
  .transform(durationToSeconds)
  .pipe(z.number().int().positive());

const rawEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
  CORS_ORIGIN: z.string().trim().min(1).optional(),
  DATABASE_URL: z.string().trim().min(1),
  JWT_ACCESS_SECRET: z.string().min(MIN_JWT_SECRET_LENGTH),
  ACCESS_TOKEN_TTL: durationSchema.default(DEFAULT_ACCESS_TOKEN_TTL_SECONDS),
});

export interface AppConfig {
  readonly nodeEnv: "development" | "test" | "production";
  readonly port: number;
  readonly logLevel: (typeof LOG_LEVELS)[number];
  readonly corsOrigins: readonly string[];
  readonly databaseUrl: string;
  readonly jwtAccessSecret: string;
  readonly accessTokenTtlSeconds: number;
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

function listProductionOnlyViolations(data: z.infer<typeof rawEnvSchema>): readonly string[] {
  if (data.NODE_ENV !== "production") return [];
  const violations: string[] = [];
  if (data.CORS_ORIGIN === undefined) violations.push("CORS_ORIGIN");
  if (data.JWT_ACCESS_SECRET.startsWith(PLACEHOLDER_SECRET_PREFIX)) {
    violations.push("JWT_ACCESS_SECRET");
  }
  return violations;
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

  const violations = listProductionOnlyViolations(parsed.data);
  if (violations.length > 0) {
    throw new ConfigError(violations);
  }

  const data = parsed.data;
  return {
    nodeEnv: data.NODE_ENV,
    port: data.PORT,
    logLevel: data.LOG_LEVEL,
    corsOrigins: splitOrigins(data.CORS_ORIGIN ?? DEFAULT_DEV_CORS_ORIGIN),
    databaseUrl: data.DATABASE_URL,
    jwtAccessSecret: data.JWT_ACCESS_SECRET,
    accessTokenTtlSeconds: data.ACCESS_TOKEN_TTL,
  };
}
