import { Router, type RequestHandler } from "express";
import type { CartController } from "../controllers/cart.controller.js";
import { requireValidResourceId, validateBody } from "../middlewares/validate.js";
import { setCartItemBodySchema } from "../schemas/cart.schema.js";

export interface CartRouterDependencies {
  readonly controller: CartController;
  readonly authenticate: RequestHandler;
}

export function createCartRouter({ controller, authenticate }: CartRouterDependencies): Router {
  const router = Router();
  router.use(authenticate);

  router.get("/", controller.getCart);
  router.put(
    "/items/:productId",
    requireValidResourceId("productId"),
    validateBody(setCartItemBodySchema),
    controller.setItemQuantity,
  );
  router.delete("/items/:productId", requireValidResourceId("productId"), controller.removeItem);
  return router;
}
