import { describe, expect, it, vi } from "vitest";
import {
  ConflictError,
  InvalidCredentialsError,
  UnauthorizedError,
} from "../../src/errors/http-errors.js";
import { createAuthService } from "../../src/services/auth.service.js";
import { createBcryptPasswordHasher } from "../../src/services/password.service.js";
import { createJwtTokenService } from "../../src/services/token.service.js";
import { createFakeUserRepository } from "../support/fake-user-repository.js";

function buildService() {
  const users = createFakeUserRepository();
  const realHasher = createBcryptPasswordHasher(4);
  const verifyAgainstDecoy = vi.fn(realHasher.verifyAgainstDecoy);
  const passwords = { ...realHasher, verifyAgainstDecoy };
  const tokens = createJwtTokenService({
    secret: "unit-test-secret-0123456789abcdef0123456789",
    ttlSeconds: 600,
  });
  return {
    service: createAuthService({ users, passwords, tokens }),
    users,
    tokens,
    verifyAgainstDecoy,
  };
}

const NEW_MEMBER = { email: "User@Example.com ", password: "Passw0rdOk", name: "小明" };

describe("register", () => {
  it("creates a USER with a normalized email and returns a usable token", async () => {
    const { service, users, tokens } = buildService();
    const session = await service.register(NEW_MEMBER);

    expect(session.user).toMatchObject({ email: "user@example.com", name: "小明", role: "USER" });
    expect(tokens.verify(session.accessToken)).toEqual({
      ok: true,
      claims: { userId: session.user.id, role: "USER" },
    });
    expect(users.records()).toHaveLength(1);
  });

  it("stores only a hash and never exposes it", async () => {
    const { service, users } = buildService();
    const session = await service.register(NEW_MEMBER);

    expect(users.records()[0]?.passwordHash).not.toBe(NEW_MEMBER.password);
    expect(Object.keys(session.user)).not.toContain("passwordHash");
    expect(JSON.stringify(session)).not.toContain("$2");
  });

  it("rejects a duplicate email regardless of case with a conflict error", async () => {
    const { service, users } = buildService();
    await service.register(NEW_MEMBER);

    await expect(
      service.register({ ...NEW_MEMBER, email: "USER@example.com" }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(users.records()).toHaveLength(1);
  });
});

describe("login", () => {
  it("returns a session for the right credentials, ignoring email case", async () => {
    const { service } = buildService();
    const registered = await service.register(NEW_MEMBER);

    const session = await service.login({ email: " USER@example.com", password: "Passw0rdOk" });
    expect(session.user.id).toBe(registered.user.id);
  });

  it("rejects a wrong password with the generic credentials error", async () => {
    const { service } = buildService();
    await service.register(NEW_MEMBER);

    await expect(
      service.login({ email: "user@example.com", password: "WrongPass1" }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("rejects an unknown email with the same error and still spends verification time", async () => {
    const { service, verifyAgainstDecoy } = buildService();

    const failure = await service
      .login({ email: "nobody@example.com", password: "Passw0rdOk" })
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(InvalidCredentialsError);
    expect(verifyAgainstDecoy).toHaveBeenCalledOnce();
  });

  it("gives identical error messages for unknown email and wrong password", async () => {
    const { service } = buildService();
    await service.register(NEW_MEMBER);

    const unknownEmail = await service
      .login({ email: "nobody@example.com", password: "Passw0rdOk" })
      .catch((error: Error) => error.message);
    const wrongPassword = await service
      .login({ email: "user@example.com", password: "WrongPass1" })
      .catch((error: Error) => error.message);
    expect(unknownEmail).toBe(wrongPassword);
  });
});

describe("getCurrentUser", () => {
  it("returns the public profile", async () => {
    const { service } = buildService();
    const { user } = await service.register(NEW_MEMBER);

    await expect(service.getCurrentUser(user.id)).resolves.toEqual(user);
  });

  it("treats a token for a deleted user as unauthorized", async () => {
    const { service } = buildService();
    await expect(service.getCurrentUser("missing-user")).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
