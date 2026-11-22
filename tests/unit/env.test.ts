import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../../src/config/env.js";

const VALID_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef";
const BASE_ENV = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  JWT_ACCESS_SECRET: VALID_SECRET,
};

function envWith(overrides: Record<string, string | undefined>) {
  return { ...BASE_ENV, ...overrides };
}

describe("loadConfig", () => {
  it("applies defaults for development", () => {
    const config = loadConfig(BASE_ENV);
    expect(config).toEqual({
      nodeEnv: "development",
      port: 3000,
      logLevel: "info",
      corsOrigins: ["http://localhost:5173"],
      databaseUrl: BASE_ENV.DATABASE_URL,
      publicBaseUrl: undefined,
      jwtAccessSecret: VALID_SECRET,
      accessTokenTtlSeconds: 7 * 24 * 60 * 60,
    });
  });

  it("splits and trims comma separated CORS origins", () => {
    const config = loadConfig(
      envWith({ CORS_ORIGIN: " https://a.example.com , https://b.example.com ," }),
    );
    expect(config.corsOrigins).toEqual(["https://a.example.com", "https://b.example.com"]);
  });

  it("requires CORS_ORIGIN in production", () => {
    expect(() => loadConfig(envWith({ NODE_ENV: "production" }))).toThrow(ConfigError);
  });

  it("accepts production when CORS_ORIGIN is set", () => {
    const config = loadConfig(
      envWith({ NODE_ENV: "production", CORS_ORIGIN: "https://shop.example.com" }),
    );
    expect(config.nodeEnv).toBe("production");
  });

  it.each(["0", "65536", "abc", "-1", "3000.5"])("rejects invalid PORT %s", (port) => {
    expect(() => loadConfig(envWith({ PORT: port }))).toThrow(ConfigError);
  });

  it("rejects unknown NODE_ENV and LOG_LEVEL", () => {
    expect(() => loadConfig(envWith({ NODE_ENV: "staging" }))).toThrow(ConfigError);
    expect(() => loadConfig(envWith({ LOG_LEVEL: "loud" }))).toThrow(ConfigError);
  });

  it("lists invalid variable names without leaking their values", () => {
    try {
      loadConfig(envWith({ PORT: "super-secret-value" }));
      expect.unreachable("loadConfig should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const message = (error as ConfigError).message;
      expect(message).toContain("PORT");
      expect(message).not.toContain("super-secret-value");
    }
  });

  it("does not mutate the provided source", () => {
    const source = Object.freeze(envWith({ PORT: "4000" }));
    expect(loadConfig(source).port).toBe(4000);
  });

  it("requires DATABASE_URL and JWT_ACCESS_SECRET", () => {
    expect(() => loadConfig({ JWT_ACCESS_SECRET: VALID_SECRET })).toThrow(/DATABASE_URL/);
    expect(() => loadConfig({ DATABASE_URL: BASE_ENV.DATABASE_URL })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it("rejects a JWT secret shorter than 32 characters", () => {
    expect(() => loadConfig(envWith({ JWT_ACCESS_SECRET: "too-short" }))).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it("rejects the placeholder JWT secret only in production", () => {
    const placeholder = "change-me-generate-with-openssl-rand-hex-32";
    expect(loadConfig(envWith({ JWT_ACCESS_SECRET: placeholder })).jwtAccessSecret).toBe(
      placeholder,
    );
    expect(() =>
      loadConfig(
        envWith({
          NODE_ENV: "production",
          CORS_ORIGIN: "https://shop.example.com",
          JWT_ACCESS_SECRET: placeholder,
        }),
      ),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });

  it.each([
    ["30s", 30],
    ["15m", 900],
    ["2h", 7200],
    ["7d", 604800],
  ])("parses ACCESS_TOKEN_TTL %s", (ttl, seconds) => {
    expect(loadConfig(envWith({ ACCESS_TOKEN_TTL: ttl })).accessTokenTtlSeconds).toBe(seconds);
  });

  it.each(["7", "d7", "7w", "-1d", "0d", "1.5h", ""])("rejects ACCESS_TOKEN_TTL %j", (ttl) => {
    expect(() => loadConfig(envWith({ ACCESS_TOKEN_TTL: ttl }))).toThrow(/ACCESS_TOKEN_TTL/);
  });

  it("accepts PUBLIC_BASE_URL and removes trailing slashes", () => {
    expect(
      loadConfig(envWith({ PUBLIC_BASE_URL: "https://api.example.com//" })).publicBaseUrl,
    ).toBe("https://api.example.com");
    expect(loadConfig(envWith({ PUBLIC_BASE_URL: "http://localhost:3000" })).publicBaseUrl).toBe(
      "http://localhost:3000",
    );
  });

  it.each(["not a url", "ftp://files.example.com", "javascript:alert(1)", "//example.com"])(
    "rejects PUBLIC_BASE_URL %j",
    (value) => {
      expect(() => loadConfig(envWith({ PUBLIC_BASE_URL: value }))).toThrow(/PUBLIC_BASE_URL/);
    },
  );
});
