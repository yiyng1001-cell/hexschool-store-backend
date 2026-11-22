import { describe, expect, it } from "vitest";
import { ForbiddenError, NotFoundError, ValidationError } from "../../src/errors/http-errors.js";
import { mapErrorToResponse } from "../../src/middlewares/error-handler.js";
import { resolveRequestId } from "../../src/middlewares/http-logger.js";

describe("mapErrorToResponse", () => {
  it("maps AppError subclasses to their status and code", () => {
    expect(mapErrorToResponse(new NotFoundError("找不到"))).toEqual({
      status: 404,
      body: { success: false, error: { code: "NOT_FOUND", message: "找不到" } },
    });
    expect(mapErrorToResponse(new ForbiddenError()).status).toBe(403);
  });

  it("includes validation details when provided", () => {
    const mapped = mapErrorToResponse(
      new ValidationError("請求欄位驗證失敗", [{ field: "password", message: "至少 8 字元" }]),
    );
    expect(mapped.status).toBe(400);
    expect(mapped.body.error.details).toEqual([{ field: "password", message: "至少 8 字元" }]);
  });

  it("omits details when none are provided", () => {
    expect(mapErrorToResponse(new ValidationError()).body.error).not.toHaveProperty("details");
  });

  it("maps malformed JSON body-parser errors to 400", () => {
    const mapped = mapErrorToResponse({ type: "entity.parse.failed", status: 400 });
    expect(mapped.status).toBe(400);
    expect(mapped.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("maps oversized body-parser errors to 413", () => {
    const mapped = mapErrorToResponse({ type: "entity.too.large", status: 413 });
    expect(mapped.status).toBe(413);
    expect(mapped.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("hides internals of unexpected errors", () => {
    const mapped = mapErrorToResponse(new Error("connection string postgres://user:pw@host"));
    expect(mapped.status).toBe(500);
    expect(mapped.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(mapped.body)).not.toContain("postgres://");
  });

  it("treats non-error throwables as internal errors", () => {
    expect(mapErrorToResponse("boom").status).toBe(500);
    expect(mapErrorToResponse(undefined).status).toBe(500);
  });
});

describe("resolveRequestId", () => {
  const generated = () => "generated-id";

  it("keeps a well-formed incoming id", () => {
    expect(resolveRequestId("abc-123_X", generated)).toBe("abc-123_X");
  });

  it("generates an id when missing", () => {
    expect(resolveRequestId(undefined, generated)).toBe("generated-id");
  });

  it.each(["has space", "bad\nline", "x".repeat(65), ""])(
    "rejects unsafe incoming id %j",
    (incoming) => {
      expect(resolveRequestId(incoming, generated)).toBe("generated-id");
    },
  );

  it("uses the first value of a repeated header", () => {
    expect(resolveRequestId(["first", "second"], generated)).toBe("first");
  });
});
