import type { RequestHandler } from "express";
import { getValidatedQuery } from "../middlewares/validate.js";
import type {
  CreateProductBody,
  ProductListQueryInput,
  UpdateProductBody,
} from "../schemas/product.schema.js";
import type { ProductService } from "../services/product.service.js";

type IdParams = { id: string };

export interface ProductController {
  readonly list: RequestHandler;
  readonly get: RequestHandler<IdParams>;
  readonly create: RequestHandler<unknown, unknown, CreateProductBody>;
  readonly update: RequestHandler<IdParams, unknown, UpdateProductBody>;
  readonly remove: RequestHandler<IdParams>;
}

export function createProductController(productService: ProductService): ProductController {
  return {
    async list(_req, res) {
      const result = await productService.list(getValidatedQuery<ProductListQueryInput>(res));
      res.status(200).json({ success: true, data: result });
    },

    async get(req, res) {
      const product = await productService.get(req.params.id);
      res.status(200).json({ success: true, data: { product } });
    },

    async create(req, res) {
      const product = await productService.create(req.body);
      res.status(201).json({ success: true, data: { product } });
    },

    async update(req, res) {
      const product = await productService.update(req.params.id, req.body);
      res.status(200).json({ success: true, data: { product } });
    },

    async remove(req, res) {
      await productService.remove(req.params.id);
      res.status(204).end();
    },
  };
}
