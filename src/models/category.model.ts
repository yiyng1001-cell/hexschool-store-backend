import type { PrismaClient } from "./prisma-postgres-client.js";

export interface CategoryRecord {
  readonly id: string;
  readonly name: string;
}

export interface CategoryRepository {
  list(): Promise<readonly CategoryRecord[]>;
}

/**
 * 分類由 seed 維護，是有界資料集；仍設定查詢上限以符合 D-2。
 */
export const MAX_CATEGORIES = 50;

export function createPrismaCategoryRepository(prisma: PrismaClient): CategoryRepository {
  return {
    list: () =>
      prisma.category.findMany({
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: MAX_CATEGORIES,
      }),
  };
}
