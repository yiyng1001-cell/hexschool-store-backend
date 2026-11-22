import express from "express";
import { pino } from "pino";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { errorHandler } from "../../src/middlewares/error-handler.js";
import { createHttpLogger } from "../../src/middlewares/http-logger.js";

const silentLogger = pino({ level: "silent" });
const ALLOWED_ORIGIN = "https://shop.example.com";

function buildApp() {
  return createApp({
    config: { corsOrigins: [ALLOWED_ORIGIN] },
    logger: silentLogger,
    authService: { register: vi.fn(), login: vi.fn(), getCurrentUser: vi.fn() },
    tokenService: { verify: () => ({ ok: false, reason: "INVALID" }) },
    productService: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    },
    categoryService: { list: vi.fn() },
  });
}

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const response = await request(buildApp()).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("is idempotent across repeated calls", async () => {
    const app = buildApp();
    const first = await request(app).get("/health");
    const second = await request(app).get("/health");
    expect(second.body).toEqual(first.body);
  });
});

describe("cross-cutting behavior", () => {
  it("returns the unified 404 for unknown routes", async () => {
    const response = await request(buildApp()).get("/api/does-not-exist");
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: "路徑不存在" },
    });
  });

  it("returns 400 VALIDATION_ERROR for malformed JSON", async () => {
    const response = await request(buildApp())
      .post("/api/anything")
      .set("Content-Type", "application/json")
      .send("{ not json");
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 413 PAYLOAD_TOO_LARGE above the 100kb limit", async () => {
    const response = await request(buildApp())
      .post("/api/anything")
      .send({ filler: "x".repeat(150 * 1024) });
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("sets an X-Request-Id header and echoes a safe incoming one", async () => {
    const app = buildApp();
    const generated = await request(app).get("/api/missing");
    expect(generated.headers["x-request-id"]).toMatch(/^[A-Za-z0-9_-]{1,64}$/);

    const echoed = await request(app).get("/api/missing").set("X-Request-Id", "client-req-1");
    expect(echoed.headers["x-request-id"]).toBe("client-req-1");
  });

  it("replaces an unsafe incoming request id", async () => {
    const response = await request(buildApp())
      .get("/api/missing")
      .set("X-Request-Id", "bad id with spaces");
    expect(response.headers["x-request-id"]).not.toBe("bad id with spaces");
  });

  it("sets security headers and hides the framework", async () => {
    const response = await request(buildApp()).get("/health");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("CORS", () => {
  it("allows the configured origin", async () => {
    const response = await request(buildApp()).get("/health").set("Origin", ALLOWED_ORIGIN);
    expect(response.headers["access-control-allow-origin"]).toBe(ALLOWED_ORIGIN);
  });

  it("does not allow other origins", async () => {
    const response = await request(buildApp()).get("/health").set("Origin", "https://evil.example");
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("error handler", () => {
  function buildAppWithThrowingRoutes() {
    const app = express();
    app.use(createHttpLogger(silentLogger));
    app.get("/sync-throw", () => {
      throw new Error("secret detail postgres://user:pw@host");
    });
    app.get("/async-throw", async () => {
      throw new Error("secret async detail");
    });
    app.use(errorHandler);
    return app;
  }

  it("returns a generic 500 for a synchronous throw without leaking details", async () => {
    const response = await request(buildAppWithThrowingRoutes()).get("/sync-throw");
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(response.body)).not.toContain("postgres://");
  });

  it("forwards rejected async handlers to the error handler", async () => {
    const response = await request(buildAppWithThrowingRoutes()).get("/async-throw");
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(response.body)).not.toContain("secret async detail");
  });
});
