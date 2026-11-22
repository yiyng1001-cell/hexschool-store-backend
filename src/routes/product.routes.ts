import { Router, type RequestHandler } from "express";
import type { ProductController } from "../controllers/product.controller.js";
import { requireRole } from "../middlewares/require-role.js";
import { requireValidResourceId, validateBody, validateQuery } from "../middlewares/validate.js";
import {
  createProductBodySchema,
  productListQuerySchema,
  updateProductBodySchema,
} from "../schemas/product.schema.js";

export interface ProductRouterDependencies {
  readonly controller: ProductController;
  readonly authenticate: RequestHandler;
}

export function createProductRouter({
  controller,
  authenticate,
}: ProductRouterDependencies): Router {
  const router = Router();
  // 管理員 API 先驗證身分與角色，再處理 id 與 body，避免對未授權者洩漏資源是否存在。
  const adminOnly = [authenticate, requireRole("ADMIN")];

  router.get("/", validateQuery(productListQuerySchema), controller.list);
  router.get("/:id", requireValidResourceId("id"), controller.get);
  router.post("/", ...adminOnly, validateBody(createProductBodySchema), controller.create);
  router.patch(
    "/:id",
    ...adminOnly,
    requireValidResourceId("id"),
    validateBody(updateProductBodySchema),
    controller.update,
  );
  router.delete("/:id", ...adminOnly, requireValidResourceId("id"), controller.remove);
  return router;
}
