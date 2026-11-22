import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createJwtTokenService } from "../../src/services/token.service.js";
import {
  createTestContext,
  resetDatabase,
  TEST_JWT_SECRET,
  type TestContext,
} from "../support/test-app.js";

const context: TestContext = createTestContext();
const { app, prisma } = context;

const MEMBER = { email: "member@example.com", password: "Passw0rdOk", name: "小明" };

function register(body: unknown = MEMBER) {
  return request(app)
    .post("/api/auth/register")
    .send(body as object);
}

function login(body: unknown) {
  return request(app)
    .post("/api/auth/login")
    .send(body as object);
}

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await resetDatabase(prisma);
  await prisma.$disconnect();
});

describe("POST /api/auth/register", () => {
  it("creates a USER and returns the user and an access token", async () => {
    const response = await register();

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user).toMatchObject({
      email: MEMBER.email,
      name: MEMBER.name,
      role: "USER",
    });
    expect(typeof response.body.data.accessToken).toBe("string");
  });

  it("stores a bcrypt hash and never the plain password", async () => {
    await register();
    const stored = await prisma.user.findUniqueOrThrow({ where: { email: MEMBER.email } });

    expect(stored.passwordHash).not.toBe(MEMBER.password);
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it("never leaks the hash or password in the response", async () => {
    const response = await register();
    const raw = JSON.stringify(response.body);

    expect(raw).not.toContain("passwordHash");
    expect(raw).not.toContain("$2");
    expect(raw).not.toContain(MEMBER.password);
  });

  it("normalizes the email", async () => {
    const response = await register({ ...MEMBER, email: "  Member@EXAMPLE.com " });
    expect(response.body.data.user.email).toBe("member@example.com");
  });

  it("rejects a duplicate email, including a different letter case, with 409", async () => {
    await register();
    const duplicate = await register({ ...MEMBER, email: "MEMBER@example.com" });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
    expect(await prisma.user.count()).toBe(1);
  });

  it("creates exactly one account when the same email registers concurrently", async () => {
    const responses = await Promise.all([register(), register(), register()]);
    const statuses = responses.map((response) => response.status).sort();

    expect(statuses).toEqual([201, 409, 409]);
    expect(await prisma.user.count()).toBe(1);
  });

  it.each([
    ["role", { role: "ADMIN" }],
    ["isAdmin", { isAdmin: true }],
  ])("rejects %s in the body with 400 and creates no account", async (field, extra) => {
    const response = await register({ ...MEMBER, ...extra });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details).toContainEqual({ field, message: "不允許的欄位" });
    expect(await prisma.user.count()).toBe(0);
  });

  it("reports weak passwords per field", async () => {
    const response = await register({ ...MEMBER, password: "short" });

    expect(response.status).toBe(400);
    expect(response.body.error.details).toContainEqual({
      field: "password",
      message: "至少 8 字元",
    });
  });

  it("rejects an empty or missing JSON body", async () => {
    const empty = await request(app).post("/api/auth/register");
    const emptyObject = await register({});

    expect(empty.status).toBe(400);
    expect(emptyObject.status).toBe(400);
    expect(emptyObject.body.error.details.length).toBeGreaterThanOrEqual(3);
  });

  it("rejects a malformed JSON body", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .set("Content-Type", "application/json")
      .send("{ broken");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/auth/login", () => {
  it("returns the user and a token that works on /me", async () => {
    await register();
    const response = await login({ email: MEMBER.email, password: MEMBER.password });

    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe(MEMBER.email);

    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${response.body.data.accessToken}`);
    expect(me.status).toBe(200);
  });

  it("accepts the email in a different letter case", async () => {
    await register();
    const response = await login({ email: "MEMBER@Example.com", password: MEMBER.password });
    expect(response.status).toBe(200);
  });

  it("answers wrong password and unknown email identically", async () => {
    await register();
    const wrongPassword = await login({ email: MEMBER.email, password: "WrongPass1" });
    const unknownEmail = await login({ email: "nobody@example.com", password: MEMBER.password });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("does not apply the registration password rules, so legacy weak passwords get 401", async () => {
    const response = await login({ email: MEMBER.email, password: "weak" });
    expect(response.status).toBe(401);
  });

  it("rejects a missing field and an undeclared field with 400", async () => {
    expect((await login({ email: MEMBER.email })).status).toBe(400);
    expect((await login({ ...MEMBER, role: "ADMIN" })).status).toBe(400);
  });

  it("rejects a password longer than the bcrypt limit instead of truncating it", async () => {
    await register({ ...MEMBER, password: `a1${"x".repeat(70)}` });
    const response = await login({ email: MEMBER.email, password: `a1${"x".repeat(80)}` });
    expect(response.status).toBe(400);
  });
});

describe("GET /api/auth/me", () => {
  async function registerAndGetToken(): Promise<string> {
    return (await register()).body.data.accessToken as string;
  }

  it("returns the profile without sensitive fields", async () => {
    const token = await registerAndGetToken();
    const response = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe(MEMBER.email);
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
  });

  it.each([
    ["no header", undefined],
    ["wrong scheme", "Basic abc"],
    ["empty token", "Bearer "],
    ["garbage token", "Bearer not-a-jwt"],
  ])("returns 401 UNAUTHORIZED for %s", async (_label, header) => {
    const req = request(app).get("/api/auth/me");
    const response = await (header === undefined ? req : req.set("Authorization", header));

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 for a tampered token", async () => {
    const token = await registerAndGetToken();
    const [header, payload, signature] = token.split(".");
    const tampered = `${header}.${payload}.${signature?.slice(0, -2)}xx`;

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${tampered}`);
    expect(response.status).toBe(401);
  });

  it("returns 401 for an expired token", async () => {
    const stored = await prisma.user.create({
      data: { email: "old@example.com", passwordHash: "x", name: "舊用戶" },
    });
    const expiredIssuer = createJwtTokenService({
      secret: TEST_JWT_SECRET,
      ttlSeconds: 60,
      now: () => Date.now() - 60 * 60 * 1000,
    });
    const token = expiredIssuer.issue({ userId: stored.id, role: "USER" });

    const response = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when the token is valid but the user no longer exists", async () => {
    const token = await registerAndGetToken();
    await prisma.user.deleteMany();

    const response = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(401);
  });

  it("ignores a role the client tries to smuggle in via headers or query", async () => {
    const token = await registerAndGetToken();
    const response = await request(app)
      .get("/api/auth/me?role=ADMIN")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Role", "ADMIN");

    expect(response.body.data.user.role).toBe("USER");
  });
});
