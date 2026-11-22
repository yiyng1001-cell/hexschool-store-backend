import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { SEED_CATEGORIES, SEED_PRODUCTS, seedCatalog } from "../../prisma/seed-catalog.js";
import { createTestContext, resetDatabase } from "../support/test-app.js";

const { app, prisma } = createTestContext();

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await resetDatabase(prisma);
  await prisma.$disconnect();
});

const listProducts = (query: string) => request(app).get(`/api/products${query}`);

describe("seedCatalog", () => {
  it("is idempotent: running twice keeps the same rows", async () => {
    await seedCatalog(prisma);
    await seedCatalog(prisma);

    expect(await prisma.category.count()).toBe(SEED_CATEGORIES.length);
    expect(await prisma.product.count()).toBe(SEED_PRODUCTS.length);
  });

  it("has enough data to demonstrate pagination, categories and search", () => {
    expect(SEED_PRODUCTS.length).toBeGreaterThanOrEqual(24);
    expect(SEED_CATEGORIES.length).toBeGreaterThanOrEqual(4);
    for (const category of SEED_CATEGORIES) {
      expect(SEED_PRODUCTS.some((product) => product.categoryId === category.id)).toBe(true);
    }
  });

  it("uses only valid products: https images and positive integer prices", async () => {
    await seedCatalog(prisma);
    const rows = await prisma.product.findMany();

    expect(rows.every((row) => row.imageUrl.startsWith("https://"))).toBe(true);
    expect(rows.every((row) => Number.isInteger(row.price) && row.price > 0)).toBe(true);
  });

  it("spreads the catalog over two pages at the default page size", async () => {
    await seedCatalog(prisma);
    const first = await listProducts("");
    const second = await listProducts("?page=2");

    expect(first.body.data.meta.totalPages).toBe(Math.ceil(SEED_PRODUCTS.length / 12));
    expect(first.body.data.items).toHaveLength(12);
    expect(second.body.data.items.length).toBeGreaterThan(0);
  });

  it("lets each category filter return exactly its products", async () => {
    await seedCatalog(prisma);
    for (const category of SEED_CATEGORIES) {
      const expected = SEED_PRODUCTS.filter((product) => product.categoryId === category.id);
      const response = await listProducts(`?category=${category.id}&limit=50`);
      expect(response.body.data.meta.total).toBe(expected.length);
    }
  });

  it.each(["木質", "棉麻", "led", "LED"])("finds products for the keyword %s", async (keyword) => {
    await seedCatalog(prisma);
    const needle = keyword.toLowerCase();
    const expected = SEED_PRODUCTS.filter((product) =>
      `${product.name}${product.description}`.toLowerCase().includes(needle),
    );

    const response = await listProducts(`?q=${encodeURIComponent(keyword)}&limit=50`);
    expect(expected.length).toBeGreaterThan(1);
    expect(response.body.data.meta.total).toBe(expected.length);
  });

  it("includes a keyword that matches a description but not the name", () => {
    const descriptionOnly = SEED_PRODUCTS.filter(
      (product) => product.description.includes("棉麻") && !product.name.includes("棉麻"),
    );
    expect(descriptionOnly.length).toBeGreaterThan(0);
  });

  it("includes products sharing a price, so sort stability is exercised", () => {
    const prices = SEED_PRODUCTS.map((product) => product.price);
    expect(new Set(prices).size).toBeLessThan(prices.length);
  });

  it("does not resurrect a product an admin deleted", async () => {
    await seedCatalog(prisma);
    const target = SEED_PRODUCTS[0]!;
    await prisma.product.update({ where: { id: target.id }, data: { deletedAt: new Date() } });
    await seedCatalog(prisma);

    expect((await request(app).get(`/api/products/${target.id}`)).status).toBe(404);
    expect(await prisma.product.count()).toBe(SEED_PRODUCTS.length);
  });

  it("restores seed fields an admin edited, keeping the same ids", async () => {
    await seedCatalog(prisma);
    const target = SEED_PRODUCTS[0]!;
    await prisma.product.update({ where: { id: target.id }, data: { price: 99999 } });
    await seedCatalog(prisma);

    const restored = await prisma.product.findUniqueOrThrow({ where: { id: target.id } });
    expect(restored.price).toBe(target.price);
  });
});
