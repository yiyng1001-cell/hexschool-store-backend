import type { RequestHandler } from "express";
import { getAuthenticatedClaims } from "../middlewares/authenticate.js";
import type { SetCartItemBody } from "../schemas/cart.schema.js";
import type { CartService } from "../services/cart.service.js";

type ProductParams = { productId: string };

export interface CartController {
  readonly getCart: RequestHandler;
  readonly setItemQuantity: RequestHandler<ProductParams, unknown, SetCartItemBody>;
  readonly removeItem: RequestHandler<ProductParams>;
}

/**
 * 使用者身分一律取自 token，請求中沒有任何 userId（S-5）。
 */
export function createCartController(cartService: CartService): CartController {
  return {
    async getCart(_req, res) {
      const { userId } = getAuthenticatedClaims(res);
      res.status(200).json({ success: true, data: { cart: await cartService.getCart(userId) } });
    },

    async setItemQuantity(req, res) {
      const { userId } = getAuthenticatedClaims(res);
      const cart = await cartService.setItemQuantity(
        userId,
        req.params.productId,
        req.body.quantity,
      );
      res.status(200).json({ success: true, data: { cart } });
    },

    async removeItem(req, res) {
      const { userId } = getAuthenticatedClaims(res);
      const cart = await cartService.removeItem(userId, req.params.productId);
      res.status(200).json({ success: true, data: { cart } });
    },
  };
}
