import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../../src/config/env.js";

describe("loadConfig", () => {
  it("applies defaults for development", () => {
    const config = loadConfig({});
    expect(config).toEqual({
      nodeEnv: "development",
      port: 3000,
      logLevel: "info",
      corsOrigins: ["http://localhost:5173"],
    });
  });

  it("splits and trims comma separated CORS origins", () => {
    const config = loadConfig({ CORS_ORIGIN: " https://a.example.com , https://b.example.com ," });
    expect(config.corsOrigins).toEqual(["https://a.example.com", "https://b.example.com"]);
  });

  it("requires CORS_ORIGIN in production", () => {
    expect(() => loadConfig({ NODE_ENV: "production" })).toThrow(ConfigError);
  });

  it("accepts production when CORS_ORIGIN is set", () => {
    const config = loadConfig({ NODE_ENV: "production", CORS_ORIGIN: "https://shop.example.com" });
    expect(config.nodeEnv).toBe("production");
  });

  it.each(["0", "65536", "abc", "-1", "3000.5"])("rejects invalid PORT %s", (port) => {
    expect(() => loadConfig({ PORT: port })).toThrow(ConfigError);
  });

  it("rejects unknown NODE_ENV and LOG_LEVEL", () => {
    expect(() => loadConfig({ NODE_ENV: "staging" })).toThrow(ConfigError);
    expect(() => loadConfig({ LOG_LEVEL: "loud" })).toThrow(ConfigError);
  });

  it("lists invalid variable names without leaking their values", () => {
    try {
      loadConfig({ PORT: "super-secret-value" });
      expect.unreachable("loadConfig should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const message = (error as ConfigError).message;
      expect(message).toContain("PORT");
      expect(message).not.toContain("super-secret-value");
    }
  });

  it("does not mutate the provided source", () => {
    const source = Object.freeze({ PORT: "4000" });
    expect(loadConfig(source).port).toBe(4000);
  });
});
