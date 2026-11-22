import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createCategory, createProduct, createUserWithToken } from "../support/catalog-fixtures.js";
import { createTestContext, resetDatabase } from "../support/test-app.js";

const context = createTestContext();
const { app, prisma } = context;

const VALID_BODY = {
  name: "木質收納盒",
  description: "桌面小物收納，天然橡木。",
  price: 580,
  imageUrl: "https://images.example.com/box.jpg",
};

let adminAuth: string;
let memberAuth: string;
let storage: { id: string; name: string };
let kitchen: { id: string; name: string };

beforeEach(async () => {
  await resetDatabase(prisma);
  storage = await createCategory(prisma, "收納");
  kitchen = await createCategory(prisma, "廚房");
  adminAuth = (await createUserWithToken(context, "ADMIN")).authorization;
  memberAuth = (await createUserWithToken(context, "USER")).authorization;
});

afterAll(async () => {
  await resetDatabase(prisma);
  await prisma.$disconnect();
});

const listProducts = (query: string = "") => request(app).get(`/api/products${query}`);

async function createMany(count: number, overrides: { price?: number; categoryId?: string } = {}) {
  const createdAtBase = Date.UTC(2026, 10, 1);
  for (let index = 0; index < count; index += 1) {
    await createProduct(prisma, {
      categoryId: overrides.categoryId ?? storage.id,
      price: overrides.price ?? 100 + index,
      createdAt: new Date(createdAtBase + index * 1000),
    });
  }
}

describe("GET /api/products — public listing", () => {
  it("works without authentication and returns the documented shape", async () => {
    await createProduct(prisma, { categoryId: storage.id, name: "木質收納盒" });
    const response = await listProducts();

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.items[0]).toEqual({
      id: expect.any(String),
      name: "木質收納盒",
      description: expect.any(String),
      price: 100,
      imageUrl: expect.any(String),
      category: { id: storage.id, name: "收納" },
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it("never exposes deletedAt", async () => {
    await createProduct(prisma, { categoryId: storage.id });
    expect(JSON.stringify((await listProducts()).body)).not.toContain("deletedAt");
  });

  it("defaults to page 1 and 12 items, with correct meta", async () => {
    await createMany(25);
    const response = await listProducts();

    expect(response.body.data.items).toHaveLength(12);
    expect(response.body.data.meta).toEqual({ page: 1, limit: 12, total: 25, totalPages: 3 });
  });

  it("returns the remainder on the last page and an empty list beyond it", async () => {
    await createMany(25);

    const last = await listProducts("?page=3");
    const beyond = await listProducts("?page=4");
    expect(last.body.data.items).toHaveLength(1);
    expect(beyond.status).toBe(200);
    expect(beyond.body.data.items).toEqual([]);
    expect(beyond.body.data.meta.total).toBe(25);
  });

  it("returns an empty list with zero pages when there are no products", async () => {
    const response = await listProducts();
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      items: [],
      meta: { page: 1, limit: 12, total: 0, totalPages: 0 },
    });
  });

  it.each([
    "limit=51",
    "limit=0",
    "limit=2.5",
    "page=0",
    "page=-1",
    "page=1.5",
    "page=abc",
    "page=1000001",
    "sort=foo",
    "q=",
    "q=%20%20",
    "category=",
    "unknown=1",
    "page=1&page=2",
  ])("rejects the invalid query %s with 400", async (query) => {
    const response = await listProducts(`?${query}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details.length).toBeGreaterThan(0);
  });

  it("accepts limit=50 and limit=1", async () => {
    await createMany(3);
    expect((await listProducts("?limit=50")).status).toBe(200);
    expect((await listProducts("?limit=1")).body.data.items).toHaveLength(1);
  });
});

describe("GET /api/products — filtering and search", () => {
  it("filters by category and reports the filtered total", async () => {
    await createMany(3, { categoryId: storage.id });
    await createMany(2, { categoryId: kitchen.id });

    const response = await listProducts(`?category=${kitchen.id}`);
    expect(response.body.data.meta.total).toBe(2);
    expect(
      response.body.data.items.every(
        (item: { category: { id: string } }) => item.category.id === kitchen.id,
      ),
    ).toBe(true);
  });

  it("returns an empty list, not 404, for an unknown category", async () => {
    await createMany(3);
    const response = await listProducts("?category=does-not-exist");

    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual([]);
  });

  it("searches name and description, ignoring case", async () => {
    await createProduct(prisma, { categoryId: storage.id, name: "LED 夜燈", description: "d" });
    await createProduct(prisma, {
      categoryId: storage.id,
      name: "檯燈",
      description: "附 led 光源",
    });
    await createProduct(prisma, { categoryId: storage.id, name: "杯子", description: "陶瓷" });

    const response = await listProducts("?q=Led");
    const names = response.body.data.items.map((item: { name: string }) => item.name).sort();
    expect(names).toEqual(["LED 夜燈", "檯燈"]);
  });

  it("trims the keyword", async () => {
    await createProduct(prisma, { categoryId: storage.id, name: "木質盒" });
    expect((await listProducts("?q=%20%E6%9C%A8%E8%B3%AA%20")).body.data.meta.total).toBe(1);
  });

  it.each([
    ["%", "100% 純棉"],
    ["_", "a_b 杯"],
    ["\\", "路徑\\檔案"],
  ])("treats %j as a literal character, not a wildcard", async (keyword, matchingName) => {
    await createProduct(prisma, { categoryId: storage.id, name: matchingName });
    await createProduct(prisma, { categoryId: storage.id, name: "普通杯子" });
    await createProduct(prisma, { categoryId: storage.id, name: "另一個商品" });

    const response = await listProducts(`?q=${encodeURIComponent(keyword)}`);
    expect(response.status).toBe(200);
    expect(response.body.data.items.map((item: { name: string }) => item.name)).toEqual([
      matchingName,
    ]);
  });

  it("combines category, keyword and pagination", async () => {
    for (let index = 0; index < 5; index += 1) {
      await createProduct(prisma, { categoryId: storage.id, name: `木質 ${index}` });
    }
    await createProduct(prisma, { categoryId: kitchen.id, name: "木質砧板" });

    const response = await listProducts(`?category=${storage.id}&q=木質&limit=2&page=3`);
    expect(response.body.data.meta).toEqual({ page: 3, limit: 2, total: 5, totalPages: 3 });
    expect(response.body.data.items).toHaveLength(1);
  });

  it("excludes soft-deleted products from items and from the total", async () => {
    await createProduct(prisma, { categoryId: storage.id, name: "保留" });
    await createProduct(prisma, { categoryId: storage.id, name: "已刪除", deletedAt: new Date() });

    const response = await listProducts();
    expect(response.body.data.meta.total).toBe(1);
    expect(response.body.data.items.map((item: { name: string }) => item.name)).toEqual(["保留"]);
  });
});

describe("GET /api/products — sorting", () => {
  it("sorts newest first by default and honors price ordering", async () => {
    const old = await createProduct(prisma, {
      categoryId: storage.id,
      price: 300,
      createdAt: new Date("2026-11-01"),
    });
    const mid = await createProduct(prisma, {
      categoryId: storage.id,
      price: 100,
      createdAt: new Date("2026-11-02"),
    });
    const recent = await createProduct(prisma, {
      categoryId: storage.id,
      price: 200,
      createdAt: new Date("2026-11-03"),
    });
    const idsFor = async (sort: string) =>
      (await listProducts(`?sort=${sort}`)).body.data.items.map((item: { id: string }) => item.id);

    expect(await idsFor("newest")).toEqual([recent.id, mid.id, old.id]);
    expect(await idsFor("price_asc")).toEqual([mid.id, recent.id, old.id]);
    expect(await idsFor("price_desc")).toEqual([old.id, recent.id, mid.id]);
  });

  it.each(["price_asc", "price_desc", "newest"])(
    "breaks ties by ascending id for %s, regardless of insertion order",
    async (sort) => {
      const sameMoment = new Date("2026-11-01T00:00:00.000Z");
      // 刻意以相反於 id 的順序插入，使「沒有次要排序」時的結果與預期不同。
      for (const id of ["tie-c", "tie-a", "tie-d", "tie-b"]) {
        await createProduct(prisma, {
          id,
          categoryId: storage.id,
          price: 500,
          createdAt: sameMoment,
        });
      }

      const response = await listProducts(`?sort=${sort}`);
      expect(response.body.data.items.map((item: { id: string }) => item.id)).toEqual([
        "tie-a",
        "tie-b",
        "tie-c",
        "tie-d",
      ]);
    },
  );

  it.each(["price_asc", "price_desc", "newest"])(
    "pages through %s results without duplicates or gaps even when prices tie",
    async (sort) => {
      const sameMoment = new Date("2026-11-01T00:00:00.000Z");
      for (let index = 0; index < 23; index += 1) {
        await createProduct(prisma, {
          categoryId: storage.id,
          price: 500,
          createdAt: sameMoment,
        });
      }

      const seen: string[] = [];
      for (let page = 1; page <= 4; page += 1) {
        const response = await listProducts(`?sort=${sort}&limit=7&page=${page}`);
        seen.push(...response.body.data.items.map((item: { id: string }) => item.id));
      }

      expect(seen).toHaveLength(23);
      expect(new Set(seen).size).toBe(23);
    },
  );
});

describe("GET /api/products/:id", () => {
  it("returns the product with its category", async () => {
    const created = await createProduct(prisma, { categoryId: storage.id, name: "木質收納盒" });
    const response = await request(app).get(`/api/products/${created.id}`);

    expect(response.status).toBe(200);
    expect(response.body.data.product).toMatchObject({
      id: created.id,
      name: "木質收納盒",
      category: { id: storage.id, name: "收納" },
    });
    expect(JSON.stringify(response.body)).not.toContain("deletedAt");
  });

  it.each([
    ["an id that does not exist", "no-such-product"],
    ["a 101-character id", "x".repeat(101)],
    ["an id with unusual characters", "%27%3B--"],
  ])("returns 404 NOT_FOUND for %s", async (_label, id) => {
    const response = await request(app).get(`/api/products/${id}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 for a soft-deleted product", async () => {
    const deleted = await createProduct(prisma, { categoryId: storage.id, deletedAt: new Date() });
    expect((await request(app).get(`/api/products/${deleted.id}`)).status).toBe(404);
  });
});

describe("POST /api/products", () => {
  const post = (authorization: string | undefined, body: unknown) => {
    const req = request(app).post("/api/products");
    return (authorization === undefined ? req : req.set("Authorization", authorization)).send(
      body as object,
    );
  };

  it("lets an admin create a product", async () => {
    const response = await post(adminAuth, { ...VALID_BODY, categoryId: storage.id });

    expect(response.status).toBe(201);
    expect(response.body.data.product).toMatchObject({
      ...VALID_BODY,
      category: { id: storage.id, name: "收納" },
    });
    expect(await prisma.product.count()).toBe(1);
  });

  it("trims text fields", async () => {
    const response = await post(adminAuth, {
      ...VALID_BODY,
      name: "  木質收納盒  ",
      categoryId: storage.id,
    });
    expect(response.body.data.product.name).toBe("木質收納盒");
  });

  it("rejects an unauthenticated caller with 401 and creates nothing", async () => {
    const response = await post(undefined, { ...VALID_BODY, categoryId: storage.id });

    expect(response.status).toBe(401);
    expect(await prisma.product.count()).toBe(0);
  });

  it("rejects a regular member with 403 and creates nothing", async () => {
    const response = await post(memberAuth, { ...VALID_BODY, categoryId: storage.id });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(await prisma.product.count()).toBe(0);
  });

  it("checks authorization before validating the body", async () => {
    const response = await post(memberAuth, { nonsense: true });
    expect(response.status).toBe(403);
  });

  it.each([
    ["a decimal price", { ...VALID_BODY, price: 580.5 }],
    ["a zero price", { ...VALID_BODY, price: 0 }],
    ["a negative price", { ...VALID_BODY, price: -5 }],
    ["a price above the maximum", { ...VALID_BODY, price: 1_000_001 }],
    ["a string price", { ...VALID_BODY, price: "580" }],
    ["an http image", { ...VALID_BODY, imageUrl: "http://images.example.com/box.jpg" }],
    ["a javascript image", { ...VALID_BODY, imageUrl: "javascript:alert(1)" }],
    ["a blank name", { ...VALID_BODY, name: "   " }],
    ["an undeclared id field", { ...VALID_BODY, id: "forced-id" }],
    ["an undeclared deletedAt field", { ...VALID_BODY, deletedAt: null }],
  ])("rejects %s with 400 and creates nothing", async (_label, body) => {
    const response = await post(adminAuth, { categoryId: storage.id, ...body });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(await prisma.product.count()).toBe(0);
  });

  it("reports every missing field", async () => {
    const response = await post(adminAuth, {});
    const fields = response.body.error.details.map((detail: { field: string }) => detail.field);

    expect(response.status).toBe(400);
    expect(fields).toEqual(
      expect.arrayContaining(["name", "description", "price", "imageUrl", "categoryId"]),
    );
  });

  it("rejects an unknown category on the categoryId field", async () => {
    const response = await post(adminAuth, { ...VALID_BODY, categoryId: "no-such-category" });

    expect(response.status).toBe(400);
    expect(response.body.error.details).toContainEqual({
      field: "categoryId",
      message: "分類不存在",
    });
    expect(await prisma.product.count()).toBe(0);
  });

  it("does not let a client choose the id", async () => {
    const response = await post(adminAuth, { ...VALID_BODY, categoryId: storage.id });
    expect(response.body.data.product.id).not.toBe("forced-id");
  });
});

describe("PATCH /api/products/:id", () => {
  const patch = (authorization: string | undefined, id: string, body: unknown) => {
    const req = request(app).patch(`/api/products/${id}`);
    return (authorization === undefined ? req : req.set("Authorization", authorization)).send(
      body as object,
    );
  };

  it("updates only the provided fields and refreshes updatedAt", async () => {
    const created = await createProduct(prisma, {
      categoryId: storage.id,
      name: "原名稱",
      price: 500,
    });
    const response = await patch(adminAuth, created.id, { price: 450 });

    expect(response.status).toBe(200);
    expect(response.body.data.product).toMatchObject({ name: "原名稱", price: 450 });
    expect(new Date(response.body.data.product.updatedAt).getTime()).toBeGreaterThan(
      created.updatedAt.getTime(),
    );
  });

  it("can move a product to another category", async () => {
    const created = await createProduct(prisma, { categoryId: storage.id });
    const response = await patch(adminAuth, created.id, { categoryId: kitchen.id });

    expect(response.body.data.product.category).toEqual({ id: kitchen.id, name: "廚房" });
  });

  it("is idempotent: repeating the same update gives the same result", async () => {
    const created = await createProduct(prisma, { categoryId: storage.id });
    const first = await patch(adminAuth, created.id, { name: "新名稱" });
    const second = await patch(adminAuth, created.id, { name: "新名稱" });

    expect(second.status).toBe(200);
    expect(second.body.data.product.name).toBe(first.body.data.product.name);
  });

  it("rejects an empty body with 400", async () => {
    const created = await createProduct(prisma, { categoryId: storage.id });
    const response = await patch(adminAuth, created.id, {});

    expect(response.status).toBe(400);
    expect(response.body.error.details).toContainEqual({
      field: "body",
      message: "至少需提供一個要修改的欄位",
    });
  });

  it("rejects invalid values and an unknown category", async () => {
    const created = await createProduct(prisma, { categoryId: storage.id, price: 500 });

    expect((await patch(adminAuth, created.id, { price: 0 })).status).toBe(400);
    expect((await patch(adminAuth, created.id, { categoryId: "no-such" })).status).toBe(400);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: created.id } })).price).toBe(500);
  });

  it("returns 404 for a missing or soft-deleted product", async () => {
    const deleted = await createProduct(prisma, { categoryId: storage.id, deletedAt: new Date() });

    expect((await patch(adminAuth, "no-such-product", { price: 1 })).status).toBe(404);
    expect((await patch(adminAuth, deleted.id, { price: 1 })).status).toBe(404);
    expect((await patch(adminAuth, "x".repeat(101), { price: 1 })).status).toBe(404);
  });

  it("answers 401 or 403 before revealing whether the product exists", async () => {
    expect((await patch(undefined, "no-such-product", { price: 1 })).status).toBe(401);
    expect((await patch(memberAuth, "no-such-product", { price: 1 })).status).toBe(403);
  });

  it("does not change anything when a member tries", async () => {
    const created = await createProduct(prisma, { categoryId: storage.id, price: 500 });
    await patch(memberAuth, created.id, { price: 1 });

    expect((await prisma.product.findUniqueOrThrow({ where: { id: created.id } })).price).toBe(500);
  });
});

describe("DELETE /api/products/:id", () => {
  const remove = (authorization: string | undefined, id: string) => {
    const req = request(app).delete(`/api/products/${id}`);
    return authorization === undefined ? req : req.set("Authorization", authorization);
  };

  it("soft deletes: gone from the API but still stored", async () => {
    const created = await createProduct(prisma, { categoryId: storage.id });
    const response = await remove(adminAuth, created.id);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect((await request(app).get(`/api/products/${created.id}`)).status).toBe(404);
    expect((await listProducts()).body.data.meta.total).toBe(0);

    const stored = await prisma.product.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.deletedAt).toBeInstanceOf(Date);
  });

  it("returns 404 when deleting again", async () => {
    const created = await createProduct(prisma, { categoryId: storage.id });
    await remove(adminAuth, created.id);

    expect((await remove(adminAuth, created.id)).status).toBe(404);
  });

  it("returns 404 for an id that never existed", async () => {
    expect((await remove(adminAuth, "no-such-product")).status).toBe(404);
  });

  it("rejects non-admins and leaves the product untouched", async () => {
    const created = await createProduct(prisma, { categoryId: storage.id });

    expect((await remove(undefined, created.id)).status).toBe(401);
    expect((await remove(memberAuth, created.id)).status).toBe(403);
    expect((await request(app).get(`/api/products/${created.id}`)).status).toBe(200);
  });

  it("answers 401 for an unauthenticated delete of a nonexistent id, not 404", async () => {
    expect((await remove(undefined, "no-such-product")).status).toBe(401);
  });

  it("does not block the deleted row's category from being referenced by other data", async () => {
    const created = await createProduct(prisma, { categoryId: storage.id });
    await remove(adminAuth, created.id);

    await expect(prisma.category.delete({ where: { id: storage.id } })).rejects.toThrow();
  });
});

describe("database constraints", () => {
  it("rejects a non-positive price at the database level", async () => {
    await expect(createProduct(prisma, { categoryId: storage.id, price: 0 })).rejects.toThrow();
    await expect(createProduct(prisma, { categoryId: storage.id, price: -1 })).rejects.toThrow();
  });

  it("rejects a duplicate category name", async () => {
    await expect(createCategory(prisma, "收納")).rejects.toThrow();
  });

  it("rejects a product that references a missing category", async () => {
    await expect(createProduct(prisma, { categoryId: "no-such-category" })).rejects.toThrow();
  });
});
