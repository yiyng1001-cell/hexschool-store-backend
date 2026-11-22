import type { RequestHandler } from "express";
import type { CategoryService } from "../services/category.service.js";

export interface CategoryController {
  readonly list: RequestHandler;
}

export function createCategoryController(categoryService: CategoryService): CategoryController {
  return {
    async list(_req, res) {
      const items = await categoryService.list();
      res.status(200).json({ success: true, data: { items } });
    },
  };
}
