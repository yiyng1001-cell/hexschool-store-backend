import { describe, expect, it, vi } from "vitest";
import { NotFoundError, ValidationError } from "../../src/errors/http-errors.js";
import type {
  ProductRecord,
  ProductRepository,
  ProductWriteResult,
} from "../../src/models/product.model.js";
import { createProductService } from "../../src/services/product.service.js";

const RECORD: ProductRecord = {
  id: "p1",
  name: "木質收納盒",
  description: "說明",
  price: 580,
  imageUrl: "https://images.example.com/box.jpg",
  category: { id: "c1", name: "收納" },
  createdAt: new Date("2026-11-01T00:00:00.000Z"),
  updatedAt: new Date("2026-11-01T00:00:00.000Z"),
};

function stubRepository(overrides: Partial<ProductRepository> = {}): ProductRepository {
  return {
    list: vi.fn(async () => ({ items: [RECORD], total: 25 })),
    findById: vi.fn(async () => RECORD),
    create: vi.fn(async (): Promise<ProductWriteResult> => ({ ok: true, product: RECORD })),
    update: vi.fn(async (): Promise<ProductWriteResult> => ({ ok: true, product: RECORD })),
    softDelete: vi.fn(async () => true),
    ...overrides,
  };
}

describe("list", () => {
  it("translates page and limit into skip and take and builds the meta", async () => {
    const products = stubRepository();
    const service = createProductService({ products });

    const result = await service.list({ page: 3, limit: 10, sort: "price_asc", q: "木質" });

    expect(products.list).toHaveBeenCalledWith({
      categoryId: undefined,
      keyword: "木質",
      sort: "price_asc",
      skip: 20,
      take: 10,
    });
    expect(result.meta).toEqual({ page: 3, limit: 10, total: 25, totalPages: 3 });
  });

  it("returns an empty page with zero total pages when nothing matches", async () => {
    const products = stubRepository({ list: vi.fn(async () => ({ items: [], total: 0 })) });
    const result = await createProductService({ products }).list({
      page: 1,
      limit: 12,
      sort: "newest",
    });
    expect(result).toEqual({ items: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } });
  });
});

describe("get", () => {
  it("throws NotFoundError when the product is missing or deleted", async () => {
    const products = stubRepository({ findById: vi.fn(async () => null) });
    await expect(createProductService({ products }).get("missing")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("create", () => {
  const FIELDS = {
    name: "木質收納盒",
    description: "說明",
    price: 580,
    imageUrl: "https://images.example.com/box.jpg",
    categoryId: "c1",
  };

  it("returns the created product", async () => {
    const service = createProductService({ products: stubRepository() });
    await expect(service.create(FIELDS)).resolves.toEqual(RECORD);
  });

  it("reports an unknown category on the categoryId field", async () => {
    const products = stubRepository({
      create: vi.fn(async (): Promise<ProductWriteResult> => ({
        ok: false,
        reason: "CATEGORY_NOT_FOUND",
      })),
    });
    const failure = await createProductService({ products })
      .create(FIELDS)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ValidationError);
    expect((failure as ValidationError).details).toEqual([
      { field: "categoryId", message: "分類不存在" },
    ]);
  });
});

describe("update", () => {
  it("rejects an empty update without touching the repository", async () => {
    const products = stubRepository();
    await expect(createProductService({ products }).update("p1", {})).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(products.update).not.toHaveBeenCalled();
  });

  it("maps a missing product to NotFoundError and a missing category to ValidationError", async () => {
    const missingProduct = stubRepository({
      update: vi.fn(async (): Promise<ProductWriteResult> => ({
        ok: false,
        reason: "PRODUCT_NOT_FOUND",
      })),
    });
    const missingCategory = stubRepository({
      update: vi.fn(async (): Promise<ProductWriteResult> => ({
        ok: false,
        reason: "CATEGORY_NOT_FOUND",
      })),
    });

    await expect(
      createProductService({ products: missingProduct }).update("p1", { price: 1 }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      createProductService({ products: missingCategory }).update("p1", { categoryId: "x" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("remove", () => {
  it("soft deletes using the injected clock", async () => {
    const deletedAt = new Date("2026-11-22T10:00:00.000Z");
    const products = stubRepository();
    await createProductService({ products, now: () => deletedAt }).remove("p1");
    expect(products.softDelete).toHaveBeenCalledWith("p1", deletedAt);
  });

  it("throws NotFoundError when nothing was deleted, which also covers repeated deletes", async () => {
    const products = stubRepository({ softDelete: vi.fn(async () => false) });
    await expect(createProductService({ products }).remove("p1")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
