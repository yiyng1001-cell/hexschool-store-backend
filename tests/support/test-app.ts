import { pino } from "pino";
import type { Express } from "express";
import { createApp } from "../../src/app.js";
import { createApplicationServices, type ApplicationServices } from "../../src/composition.js";
import {
  createPrismaPostgresClient,
  type PrismaClient,
} from "../../src/models/prisma-postgres-client.js";
import { assertLocalTestDatabaseUrl } from "./test-database.js";

export const TEST_JWT_SECRET = "test-only-secret-0123456789abcdef0123456789abcdef";
export const TEST_ACCESS_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
export const TEST_ALLOWED_ORIGIN = "https://shop.example.com";
// 測試使用最低的 bcrypt cost 以縮短時間。
const TEST_PASSWORD_HASH_COST = 4;

export interface TestContext {
  readonly prisma: PrismaClient;
  readonly app: Express;
  readonly services: ApplicationServices;
}

export function createTestContext(): TestContext {
  const prisma = createPrismaPostgresClient(
    assertLocalTestDatabaseUrl(process.env["TEST_DATABASE_URL"]),
  );
  const services = createApplicationServices({
    prisma,
    jwtAccessSecret: TEST_JWT_SECRET,
    accessTokenTtlSeconds: TEST_ACCESS_TOKEN_TTL_SECONDS,
    passwordHashCost: TEST_PASSWORD_HASH_COST,
  });
  const app = createApp({
    config: { corsOrigins: [TEST_ALLOWED_ORIGIN] },
    logger: pino({ level: "silent" }),
    ...services,
  });
  return { prisma, app, services };
}

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  // 依外鍵順序刪除：商品 → 分類 → 使用者。
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
}
