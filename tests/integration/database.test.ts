import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createPrismaPostgresClient,
  type PrismaClient,
} from "../../src/models/prisma-postgres-client.js";
import { assertLocalTestDatabaseUrl } from "../support/test-database.js";

describe("test database connection", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = createPrismaPostgresClient(
      assertLocalTestDatabaseUrl(process.env["TEST_DATABASE_URL"]),
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("connects to the dedicated test database", async () => {
    const rows = await prisma.$queryRaw<{ name: string }[]>`select current_database() as name`;
    expect(rows[0]?.name).toBe("store_test");
  });
});
