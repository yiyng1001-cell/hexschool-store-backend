import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { withServerUrl, loadOpenApiDocument } from "../../src/docs/openapi-document.js";
import { createApp } from "../../src/app.js";
import { pino } from "pino";

function buildApp(publicBaseUrl?: string) {
  return createApp({
    config: { corsOrigins: ["https://shop.example.com"] },
    logger: pino({ level: "silent" }),
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
    cartService: { getCart: vi.fn(), setItemQuantity: vi.fn(), removeItem: vi.fn() },
    apiDocument: withServerUrl(loadOpenApiDocument(), publicBaseUrl),
  });
}

describe("GET /api-docs", () => {
  it("serves the Swagger UI page without authentication", async () => {
    const response = await request(buildApp()).get("/api-docs/");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.text).toContain("swagger-ui");
  });

  it("serves the Swagger UI static assets", async () => {
    const app = buildApp();
    const page = await request(app).get("/api-docs/");
    const bundle = /src="\.\/(swagger-ui-bundle\.js)"/.exec(page.text)?.[1];

    expect(bundle).toBeDefined();
    const asset = await request(app).get(`/api-docs/${bundle}`);
    expect(asset.status).toBe(200);
    expect(asset.headers["content-type"]).toContain("javascript");
  });

  it("only loads scripts from its own origin, so the strict CSP does not block it", async () => {
    const response = await request(buildApp()).get("/api-docs/");
    const csp = response.headers["content-security-policy"] ?? "";
    const scriptTags = response.text.match(/<script[^>]*>/g) ?? [];

    expect(csp).toContain("script-src 'self'");
    expect(scriptTags.length).toBeGreaterThan(0);
    expect(scriptTags.every((tag) => /\ssrc="(?!https?:|\/\/)[^"]+"/.test(tag))).toBe(true);
  });
});

describe("GET /openapi.json", () => {
  it("returns the OpenAPI document as JSON without authentication", async () => {
    const response = await request(buildApp()).get("/openapi.json");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body.openapi).toMatch(/^3\./);
    expect(Object.keys(response.body.paths)).toContain("/api/cart");
  });

  it("points servers at the current origin by default", async () => {
    const response = await request(buildApp()).get("/openapi.json");
    expect(response.body.servers).toEqual([{ url: "/", description: "目前的伺服器" }]);
  });

  it("points servers at PUBLIC_BASE_URL when configured", async () => {
    const response = await request(buildApp("https://api.example.com")).get("/openapi.json");
    expect(response.body.servers[0].url).toBe("https://api.example.com");
  });
});
