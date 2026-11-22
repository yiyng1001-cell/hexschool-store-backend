import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { ForbiddenError, UnauthorizedError } from "../../src/errors/http-errors.js";
import {
  createAuthenticate,
  extractBearerToken,
  getAuthenticatedClaims,
} from "../../src/middlewares/authenticate.js";
import { requireRole } from "../../src/middlewares/require-role.js";
import type { VerifyTokenResult } from "../../src/services/token.service.js";

function fakeRequest(authorization?: string): Request {
  return { headers: authorization === undefined ? {} : { authorization } } as Request;
}

function fakeResponse(): Response {
  return { locals: {} } as Response;
}

const GOOD_RESULT: VerifyTokenResult = { ok: true, claims: { userId: "u1", role: "USER" } };
const BAD_RESULT: VerifyTokenResult = { ok: false, reason: "INVALID" };

describe("extractBearerToken", () => {
  it.each([
    ["Bearer abc.def.ghi", "abc.def.ghi"],
    ["bearer abc", "abc"],
    ["BEARER abc", "abc"],
  ])("extracts from %j", (header, token) => {
    expect(extractBearerToken(header)).toBe(token);
  });

  it.each([undefined, "", "Bearer", "Bearer ", "Basic abc", "Bearer a b", "abc"])(
    "returns undefined for %j",
    (header) => {
      expect(extractBearerToken(header)).toBeUndefined();
    },
  );
});

describe("createAuthenticate", () => {
  it("stores the claims and continues for a valid token", () => {
    const verify = vi.fn(() => GOOD_RESULT);
    const res = fakeResponse();
    const next = vi.fn();

    createAuthenticate({ verify })(fakeRequest("Bearer good"), res, next);

    expect(verify).toHaveBeenCalledWith("good");
    expect(next).toHaveBeenCalledWith();
    expect(getAuthenticatedClaims(res)).toEqual({ userId: "u1", role: "USER" });
  });

  it("forwards an UnauthorizedError for an invalid token", () => {
    const next = vi.fn();
    createAuthenticate({ verify: () => BAD_RESULT })(
      fakeRequest("Bearer bad"),
      fakeResponse(),
      next,
    );
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(UnauthorizedError);
  });

  it("does not call verify when the header is missing or malformed", () => {
    const verify = vi.fn(() => GOOD_RESULT);
    const next = vi.fn();
    createAuthenticate({ verify })(fakeRequest(), fakeResponse(), next);
    createAuthenticate({ verify })(fakeRequest("Basic abc"), fakeResponse(), next);

    expect(verify).not.toHaveBeenCalled();
    expect(next.mock.calls.every(([error]) => error instanceof UnauthorizedError)).toBe(true);
  });
});

describe("requireRole", () => {
  it("lets the required role through", () => {
    const res = fakeResponse();
    res.locals["auth"] = { userId: "a1", role: "ADMIN" };
    const next = vi.fn();

    requireRole("ADMIN")(fakeRequest(), res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("forbids a different role with 403", () => {
    const res = fakeResponse();
    res.locals["auth"] = { userId: "u1", role: "USER" };
    const next = vi.fn();

    requireRole("ADMIN")(fakeRequest(), res, next);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(ForbiddenError);
  });

  it("treats a missing identity as unauthenticated rather than forbidden", () => {
    expect(() => requireRole("ADMIN")(fakeRequest(), fakeResponse(), vi.fn())).toThrow(
      UnauthorizedError,
    );
  });
});
