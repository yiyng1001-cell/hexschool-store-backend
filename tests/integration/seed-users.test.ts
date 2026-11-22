import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  buildSeedUserSpecs,
  DEMO_MEMBER,
  SeedConfigError,
  seedUsers,
} from "../../prisma/seed-users.js";
import { createBcryptPasswordHasher } from "../../src/services/password.service.js";
import { createTestContext, resetDatabase } from "../support/test-app.js";

const { app, prisma } = createTestContext();
const hasher = createBcryptPasswordHasher(4);

const SEED_ENV = { ADMIN_EMAIL: "Admin@Example.com", ADMIN_PASSWORD: "AdminPass123" };

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await resetDatabase(prisma);
  await prisma.$disconnect();
});

function loginAs(email: string, password: string) {
  return request(app).post("/api/auth/login").send({ email, password });
}

describe("seedUsers", () => {
  it("creates the admin and the demo member with the right roles", async () => {
    await seedUsers(prisma, hasher, buildSeedUserSpecs(SEED_ENV));

    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@example.com" } });
    const member = await prisma.user.findUniqueOrThrow({ where: { email: DEMO_MEMBER.email } });
    expect(admin.role).toBe("ADMIN");
    expect(member.role).toBe("USER");
  });

  it("is idempotent: running it again keeps exactly one admin", async () => {
    const specs = buildSeedUserSpecs(SEED_ENV);
    await seedUsers(prisma, hasher, specs);
    await seedUsers(prisma, hasher, specs);

    expect(await prisma.user.count({ where: { role: "ADMIN" } })).toBe(1);
    expect(await prisma.user.count()).toBe(2);
  });

  it("lets the seeded admin and demo member log in, and the admin token carries ADMIN", async () => {
    await seedUsers(prisma, hasher, buildSeedUserSpecs(SEED_ENV));

    const admin = await loginAs("admin@example.com", SEED_ENV.ADMIN_PASSWORD);
    const member = await loginAs(DEMO_MEMBER.email, DEMO_MEMBER.password);
    expect(admin.status).toBe(200);
    expect(admin.body.data.user.role).toBe("ADMIN");
    expect(member.status).toBe(200);
    expect(member.body.data.user.role).toBe("USER");
  });

  it("applies a rotated admin password on re-seed", async () => {
    await seedUsers(prisma, hasher, buildSeedUserSpecs(SEED_ENV));
    await seedUsers(
      prisma,
      hasher,
      buildSeedUserSpecs({ ...SEED_ENV, ADMIN_PASSWORD: "RotatedPass456" }),
    );

    expect((await loginAs("admin@example.com", "RotatedPass456")).status).toBe(200);
    expect((await loginAs("admin@example.com", SEED_ENV.ADMIN_PASSWORD)).status).toBe(401);
  });

  it("restores the ADMIN role if the admin account was demoted", async () => {
    await seedUsers(prisma, hasher, buildSeedUserSpecs(SEED_ENV));
    await prisma.user.update({ where: { email: "admin@example.com" }, data: { role: "USER" } });
    await seedUsers(prisma, hasher, buildSeedUserSpecs(SEED_ENV));

    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@example.com" } });
    expect(admin.role).toBe("ADMIN");
  });
});

describe("buildSeedUserSpecs", () => {
  it("lists invalid variable names without leaking their values", () => {
    try {
      buildSeedUserSpecs({ ADMIN_EMAIL: "not-an-email", ADMIN_PASSWORD: "weak" });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(SeedConfigError);
      const message = (error as SeedConfigError).message;
      expect(message).toContain("ADMIN_EMAIL");
      expect(message).toContain("ADMIN_PASSWORD");
      expect(message).not.toContain("not-an-email");
      expect(message).not.toContain("weak");
    }
  });

  it("requires both variables", () => {
    expect(() => buildSeedUserSpecs({})).toThrow(SeedConfigError);
  });
});
