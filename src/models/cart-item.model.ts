import { MAX_CART_ITEMS } from "./cart-limits.js";
import type { PrismaClient } from "./prisma-postgres-client.js";

export interface CartLineRecord {
  readonly quantity: number;
  readonly product: {
    readonly id: string;
    readonly name: string;
    readonly price: number;
    readonly imageUrl: string;
    readonly deletedAt: Date | null;
    readonly category: { readonly id: string; readonly name: string };
  };
}

export type SetQuantityResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "USER_NOT_FOUND" | "PRODUCT_NOT_FOUND" | "CART_FULL" };

export interface CartRepository {
  listByUser(userId: string): Promise<readonly CartLineRecord[]>;
  setQuantity(userId: string, productId: string, quantity: number): Promise<SetQuantityResult>;
  remove(userId: string, productId: string): Promise<boolean>;
}

export function createPrismaCartRepository(prisma: PrismaClient): CartRepository {
  return {
    /**
     * 刻意連同已軟刪除的商品一併取出：購物車需要顯示「已不可購買」的項目。
     * 這是對「查詢一律排除已刪除商品」的唯一例外（見 specs/003-cart）。
     */
    listByUser: (userId) =>
      prisma.cartItem.findMany({
        where: { userId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: MAX_CART_ITEMS,
        select: {
          quantity: true,
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              imageUrl: true,
              deletedAt: true,
              category: { select: { id: true, name: true } },
            },
          },
        },
      }),

    /**
     * 先鎖定該使用者的資料列，使同一會員的購物車寫入逐一執行；
     * 如此「品項上限」與「重複加入」在並發下都是精確的，不會短暫超過上限或產生重複列。
     */
    setQuantity: (userId, productId, quantity) =>
      prisma.$transaction(async (tx): Promise<SetQuantityResult> => {
        const lockedUsers = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM users WHERE id = ${userId} FOR UPDATE
        `;
        if (lockedUsers.length === 0) return { ok: false, reason: "USER_NOT_FOUND" };

        const product = await tx.product.findFirst({
          where: { id: productId, deletedAt: null },
          select: { id: true },
        });
        if (product === null) return { ok: false, reason: "PRODUCT_NOT_FOUND" };

        const existing = await tx.cartItem.findUnique({
          where: { userId_productId: { userId, productId } },
          select: { id: true },
        });
        if (existing !== null) {
          await tx.cartItem.update({ where: { id: existing.id }, data: { quantity } });
          return { ok: true };
        }

        const itemCount = await tx.cartItem.count({ where: { userId } });
        if (itemCount >= MAX_CART_ITEMS) return { ok: false, reason: "CART_FULL" };

        await tx.cartItem.create({ data: { userId, productId, quantity } });
        return { ok: true };
      }),

    async remove(userId, productId) {
      const { count } = await prisma.cartItem.deleteMany({ where: { userId, productId } });
      return count > 0;
    },
  };
}
