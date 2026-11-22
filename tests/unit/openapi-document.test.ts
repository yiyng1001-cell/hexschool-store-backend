import { describe, expect, it } from "vitest";
import {
  loadOpenApiDocument,
  OpenApiDocumentError,
  parseOpenApiDocument,
  withServerUrl,
} from "../../src/docs/openapi-document.js";

type Json = Record<string, unknown>;

const document = loadOpenApiDocument() as Json;
const paths = document["paths"] as Record<string, Record<string, Json>>;
const HTTP_METHODS = ["get", "put", "post", "delete", "patch"];

function operations() {
  return Object.entries(paths).flatMap(([path, item]) =>
    HTTP_METHODS.filter((method) => item[method] !== undefined).map((method) => ({
      path,
      method,
      operation: item[method] as Json,
    })),
  );
}

function resolve(ref: string): unknown {
  return ref
    .replace(/^#\//, "")
    .split("/")
    .reduce<unknown>((node, key) => (node as Json | undefined)?.[key], document);
}

function collectRefs(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(collectRefs);
  if (typeof node !== "object" || node === null) return [];
  return Object.entries(node).flatMap(([key, value]) =>
    key === "$ref" && typeof value === "string" ? [value] : collectRefs(value),
  );
}

describe("openapi.yaml", () => {
  it("is an OpenAPI 3 document with info and paths", () => {
    expect(String(document["openapi"])).toMatch(/^3\./);
    expect(document["info"]).toBeTruthy();
    expect(Object.keys(paths).length).toBeGreaterThan(0);
  });

  it("documents every implemented endpoint", () => {
    const documented = operations().map(({ method, path }) => `${method.toUpperCase()} ${path}`);

    expect(documented.sort()).toEqual(
      [
        "POST /api/auth/register",
        "POST /api/auth/login",
        "GET /api/auth/me",
        "GET /api/products",
        "POST /api/products",
        "GET /api/products/{id}",
        "PATCH /api/products/{id}",
        "DELETE /api/products/{id}",
        "GET /api/categories",
        "GET /api/cart",
        "PUT /api/cart/items/{productId}",
        "DELETE /api/cart/items/{productId}",
      ].sort(),
    );
  });

  it("resolves every $ref", () => {
    const broken = [...new Set(collectRefs(document))].filter((ref) => resolve(ref) === undefined);
    expect(broken).toEqual([]);
  });

  it("gives every operation a unique operationId, a summary and a tag", () => {
    const ids = operations().map(({ operation }) => operation["operationId"]);

    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    for (const { operation } of operations()) {
      expect(operation["summary"]).toBeTruthy();
      expect((operation["tags"] as string[]).length).toBeGreaterThan(0);
    }
  });

  it("gives every operation a success response", () => {
    for (const { path, method, operation } of operations()) {
      const codes = Object.keys(operation["responses"] as Json);
      expect(
        codes.some((code) => code.startsWith("2")),
        `${method} ${path}`,
      ).toBe(true);
    }
  });

  it("documents 401 for every operation that requires a token", () => {
    for (const { path, method, operation } of operations()) {
      if (operation["security"] === undefined) continue;
      expect(Object.keys(operation["responses"] as Json), `${method} ${path}`).toContain("401");
    }
  });

  it("documents 403 for the admin-only product operations", () => {
    for (const [path, method] of [
      ["/api/products", "post"],
      ["/api/products/{id}", "patch"],
      ["/api/products/{id}", "delete"],
    ] as const) {
      expect(
        Object.keys(paths[path]![method]!["responses"] as Json),
        `${method} ${path}`,
      ).toContain("403");
    }
  });

  it("references only security schemes that are defined", () => {
    const schemes = Object.keys(
      ((document["components"] as Json)["securitySchemes"] as Json) ?? {},
    );
    const used = operations().flatMap(({ operation }) =>
      ((operation["security"] as Record<string, unknown>[] | undefined) ?? []).flatMap(Object.keys),
    );
    expect(used.length).toBeGreaterThan(0);
    expect(used.every((name) => schemes.includes(name))).toBe(true);
  });

  it("lists every error code the API can return", () => {
    const codes = (((document["components"] as Json)["schemas"] as Json)["ErrorCode"] as Json)[
      "enum"
    ] as string[];
    expect(codes).toEqual(
      expect.arrayContaining([
        "VALIDATION_ERROR",
        "INVALID_CREDENTIALS",
        "UNAUTHORIZED",
        "FORBIDDEN",
        "NOT_FOUND",
        "EMAIL_ALREADY_EXISTS",
      ]),
    );
  });
});

describe("parseOpenApiDocument", () => {
  it.each(["", "just text", "- a\n- b", "openapi: 3.0.3", "paths: {}"])("rejects %j", (text) => {
    expect(() => parseOpenApiDocument(text)).toThrow(OpenApiDocumentError);
  });

  it("accepts a minimal valid document", () => {
    expect(parseOpenApiDocument("openapi: 3.0.3\npaths: {}\n")["openapi"]).toBe("3.0.3");
  });
});

describe("withServerUrl", () => {
  it("falls back to the relative root so Try it out hits the current origin", () => {
    expect(withServerUrl(document, undefined)["servers"]).toEqual([
      { url: "/", description: "目前的伺服器" },
    ]);
  });

  it("uses the configured public URL", () => {
    expect(withServerUrl(document, "https://api.example.com")["servers"]).toEqual([
      { url: "https://api.example.com", description: "目前的伺服器" },
    ]);
  });

  it("does not mutate the original document", () => {
    const before = JSON.stringify(document);
    withServerUrl(document, "https://api.example.com");
    expect(JSON.stringify(document)).toBe(before);
  });
});
