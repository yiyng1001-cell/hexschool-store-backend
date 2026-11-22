import { NotFoundError, ValidationError } from "../errors/http-errors.js";
import type {
  ProductFields,
  ProductRecord,
  ProductRepository,
  ProductSort,
  ProductWriteResult,
} from "../models/product.model.js";
import { buildPageMeta, toPageWindow, type PageMeta } from "./pagination.js";

export interface ProductListQuery {
  readonly page: number;
  readonly limit: number;
  readonly category?: string | undefined;
  readonly q?: string | undefined;
  readonly sort: ProductSort;
}

export interface ProductListResult {
  readonly items: readonly ProductRecord[];
  readonly meta: PageMeta;
}

export interface ProductService {
  list(query: ProductListQuery): Promise<ProductListResult>;
  get(id: string): Promise<ProductRecord>;
  create(fields: ProductFields): Promise<ProductRecord>;
  update(id: string, fields: Partial<ProductFields>): Promise<ProductRecord>;
  remove(id: string): Promise<void>;
}

export interface ProductServiceDependencies {
  readonly products: ProductRepository;
  readonly now?: () => Date;
}

const PRODUCT_NOT_FOUND_MESSAGE = "商品不存在或已下架";

function productNotFound(): NotFoundError {
  return new NotFoundError(PRODUCT_NOT_FOUND_MESSAGE);
}

function unwrapWrite(result: ProductWriteResult): ProductRecord {
  if (result.ok) return result.product;
  if (result.reason === "CATEGORY_NOT_FOUND") {
    throw new ValidationError(undefined, [{ field: "categoryId", message: "分類不存在" }]);
  }
  throw productNotFound();
}

export function createProductService({
  products,
  now = () => new Date(),
}: ProductServiceDependencies): ProductService {
  return {
    async list(query) {
      const { skip, take } = toPageWindow(query);
      const page = await products.list({
        categoryId: query.category,
        keyword: query.q,
        sort: query.sort,
        skip,
        take,
      });
      return { items: page.items, meta: buildPageMeta(query, page.total) };
    },

    async get(id) {
      const product = await products.findById(id);
      if (product === null) throw productNotFound();
      return product;
    },

    async create(fields) {
      return unwrapWrite(await products.create(fields));
    },

    async update(id, fields) {
      if (Object.keys(fields).length === 0) {
        throw new ValidationError(undefined, [
          { field: "body", message: "至少需提供一個要修改的欄位" },
        ]);
      }
      return unwrapWrite(await products.update(id, fields));
    },

    async remove(id) {
      const removed = await products.softDelete(id, now());
      if (!removed) throw productNotFound();
    },
  };
}
