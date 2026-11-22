import { NotFoundError, UnauthorizedError, ValidationError } from "../errors/http-errors.js";
import { MAX_CART_ITEMS } from "../models/cart-limits.js";
import type { CartRepository, SetQuantityResult } from "../models/cart-item.model.js";
import { buildCartView, type CartView } from "./cart-summary.service.js";

export interface CartService {
  getCart(userId: string): Promise<CartView>;
  setItemQuantity(userId: string, productId: string, quantity: number): Promise<CartView>;
  removeItem(userId: string, productId: string): Promise<CartView>;
}

function assertSetQuantitySucceeded(result: SetQuantityResult): void {
  if (result.ok) return;
  switch (result.reason) {
    case "USER_NOT_FOUND":
      throw new UnauthorizedError();
    case "PRODUCT_NOT_FOUND":
      throw new NotFoundError("商品不存在或已下架");
    case "CART_FULL":
      throw new ValidationError(undefined, [
        { field: "productId", message: `購物車已滿，最多 ${MAX_CART_ITEMS} 種商品` },
      ]);
  }
}

export function createCartService(carts: CartRepository): CartService {
  const readCart = async (userId: string): Promise<CartView> =>
    buildCartView(await carts.listByUser(userId));

  return {
    getCart: readCart,

    async setItemQuantity(userId, productId, quantity) {
      assertSetQuantitySucceeded(await carts.setQuantity(userId, productId, quantity));
      return readCart(userId);
    },

    async removeItem(userId, productId) {
      const removed = await carts.remove(userId, productId);
      if (!removed) throw new NotFoundError("購物車中沒有此商品");
      return readCart(userId);
    },
  };
}
