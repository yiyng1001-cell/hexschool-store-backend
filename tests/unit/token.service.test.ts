import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { createJwtTokenService } from "../../src/services/token.service.js";

const SECRET = "unit-test-secret-0123456789abcdef0123456789";
const TTL_SECONDS = 600;
const ISSUED_AT_MS = Date.UTC(2026, 10, 22, 0, 0, 0);

function serviceAt(nowMs: number, secret = SECRET) {
  return createJwtTokenService({ secret, ttlSeconds: TTL_SECONDS, now: () => nowMs });
}

function base64Url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

describe("createJwtTokenService", () => {
  it("round-trips the user id and role", () => {
    const service = serviceAt(ISSUED_AT_MS);
    const token = service.issue({ userId: "user-1", role: "ADMIN" });
    expect(service.verify(token)).toEqual({
      ok: true,
      claims: { userId: "user-1", role: "ADMIN" },
    });
  });

  it("is valid just before expiry and expired exactly at the TTL", () => {
    const token = serviceAt(ISSUED_AT_MS).issue({ userId: "u", role: "USER" });
    expect(serviceAt(ISSUED_AT_MS + (TTL_SECONDS - 1) * 1000).verify(token).ok).toBe(true);
    expect(serviceAt(ISSUED_AT_MS + TTL_SECONDS * 1000).verify(token)).toEqual({
      ok: false,
      reason: "EXPIRED",
    });
  });

  it("rejects a token signed with another secret", () => {
    const token = serviceAt(ISSUED_AT_MS, "another-secret-0123456789abcdef012345").issue({
      userId: "u",
      role: "USER",
    });
    expect(serviceAt(ISSUED_AT_MS).verify(token)).toEqual({ ok: false, reason: "INVALID" });
  });

  it("rejects a tampered payload", () => {
    const service = serviceAt(ISSUED_AT_MS);
    const [header, , signature] = service.issue({ userId: "u", role: "USER" }).split(".");
    const forgedPayload = base64Url({
      sub: "u",
      role: "ADMIN",
      iat: ISSUED_AT_MS / 1000,
      exp: ISSUED_AT_MS / 1000 + TTL_SECONDS,
    });
    expect(service.verify(`${header}.${forgedPayload}.${signature}`).ok).toBe(false);
  });

  it("rejects an unsigned token using the none algorithm", () => {
    const unsigned = `${base64Url({ alg: "none", typ: "JWT" })}.${base64Url({
      sub: "u",
      role: "ADMIN",
      exp: ISSUED_AT_MS / 1000 + TTL_SECONDS,
    })}.`;
    expect(serviceAt(ISSUED_AT_MS).verify(unsigned).ok).toBe(false);
  });

  it("rejects a token signed with a different HMAC algorithm", () => {
    const token = jwt.sign({ sub: "u", role: "USER" }, SECRET, {
      algorithm: "HS512",
      expiresIn: TTL_SECONDS,
    });
    expect(serviceAt(Date.now()).verify(token).ok).toBe(false);
  });

  it("rejects a validly signed token without an expiry", () => {
    const token = jwt.sign({ sub: "u", role: "USER" }, SECRET, { algorithm: "HS256" });
    expect(serviceAt(ISSUED_AT_MS).verify(token).ok).toBe(false);
  });

  it("rejects a validly signed token with an unknown role or missing subject", () => {
    const exp = ISSUED_AT_MS / 1000 + TTL_SECONDS;
    const unknownRole = jwt.sign({ sub: "u", role: "ROOT", exp }, SECRET);
    const missingSubject = jwt.sign({ role: "USER", exp }, SECRET);
    expect(serviceAt(ISSUED_AT_MS).verify(unknownRole).ok).toBe(false);
    expect(serviceAt(ISSUED_AT_MS).verify(missingSubject).ok).toBe(false);
  });

  it.each(["", "not-a-jwt", "a.b.c"])("rejects malformed token %j", (token) => {
    expect(serviceAt(ISSUED_AT_MS).verify(token)).toEqual({ ok: false, reason: "INVALID" });
  });

  it.each([0, -1, 1.5])("rejects an invalid TTL of %s", (ttlSeconds) => {
    expect(() => createJwtTokenService({ secret: SECRET, ttlSeconds })).toThrow(RangeError);
  });

  it("rejects an empty secret", () => {
    expect(() => createJwtTokenService({ secret: "", ttlSeconds: 60 })).toThrow();
  });
});
