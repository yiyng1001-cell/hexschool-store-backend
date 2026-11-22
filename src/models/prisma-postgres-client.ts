import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

export type { PrismaClient };

/**
 * 耦合 Prisma 與 `pg` driver adapter（Prisma 7 執行期必須提供 adapter）。
 * 只有 models 層可以呼叫它（A-5）。
 */
export function createPrismaPostgresClient(databaseUrl: string): PrismaClient {
  if (databaseUrl.trim().length === 0) {
    throw new Error("databaseUrl must not be empty");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}
