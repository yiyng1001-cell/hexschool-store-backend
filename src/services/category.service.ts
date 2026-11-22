import type { CategoryRecord, CategoryRepository } from "../models/category.model.js";

export interface CategoryService {
  list(): Promise<readonly CategoryRecord[]>;
}

export function createCategoryService(categories: CategoryRepository): CategoryService {
  return { list: () => categories.list() };
}
