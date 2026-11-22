import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createCategory } from "../support/catalog-fixtures.js";
import { createTestContext, resetDatabase } from "../support/test-app.js";

const { app, prisma } = createTestContext();

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await resetDatabase(prisma);
  await prisma.$disconnect();
});

describe("GET /api/categories", () => {
  it("is public and returns categories sorted by name", async () => {
    const kitchen = await createCategory(prisma, "b-廚房");
    const home = await createCategory(prisma, "a-家居");

    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        items: [
          { id: home.id, name: "a-家居" },
          { id: kitchen.id, name: "b-廚房" },
        ],
      },
    });
  });

  it("returns an empty list when there are no categories", async () => {
    const response = await request(app).get("/api/categories");
    expect(response.body.data.items).toEqual([]);
  });

  it("caps the result at 50 categories", async () => {
    await prisma.category.createMany({
      data: Array.from({ length: 55 }, (_, index) => ({
        name: `分類-${String(index).padStart(2, "0")}`,
      })),
    });

    const response = await request(app).get("/api/categories");
    expect(response.body.data.items).toHaveLength(50);
  });

  it.each(["post", "put", "patch", "delete"] as const)(
    "does not offer a %s endpoint, since categories are managed by seed",
    async (method) => {
      const response = await request(app)[method]("/api/categories");
      expect(response.status).toBe(404);
    },
  );
});
