import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MAX_CART_ITEMS } from "../../src/models/cart-limits.js";
import { createCategory, createProduct, createUserWithToken } from "../support/catalog-fixtures.js";
import { createTestContext, resetDatabase } from "../support/test-app.js";

const context = createTestContext();
const { app, prisma } = context;

let category: { id: string; name: string };
let alice: { userId: string; authorization: string };
let bob: { userId: string; authorization: string };

beforeEach(async () => {
  await resetDatabase(prisma);
  category = await createCategory(prisma, "收納");
  alice = await createUserWithToken(context, "USER");
  bob = await createUserWithToken(context, "USER");
});

afterAll(async () => {
  await resetDatabase(prisma);
  await prisma.$disconnect();
});

const getCart = (authorization?: string) => {
  const req = request(app).get("/api/cart");
  return authorization === undefined ? req : req.set("Authorization", authorization);
};

const putItem = (authorization: string | undefined, productId: string, body: unknown) => {
  const req = request(app).put(`/api/cart/items/${productId}`);
  return (authorization === undefined ? req : req.set("Authorization", authorization)).send(
    body as object,
  );
};

const deleteItem = (authorization: string | undefined, productId: string) => {
  const req = request(app).delete(`/api/cart/items/${productId}`);
  return authorization === undefined ? req : req.set("Authorization", authorization);
};

const newProduct = (overrides: { price?: number; name?: string; deletedAt?: Date } = {}) =>
  createProduct(prisma, { categoryId: category.id, ...overrides });

describe("authentication", () => {
  it.each([
    ["GET /api/cart", () => getCart()],
    ["PUT /api/cart/items/:id", () => putItem(undefined, "any", { quantity: 1 })],
    ["DELETE /api/cart/items/:id", () => deleteItem(undefined, "any")],
  ])("rejects %s without a token with 401", async (_label, call) => {
    const response = await call();

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects an invalid token", async () => {
    expect((await getCart("Bearer not-a-jwt")).status).toBe(401);
  });

  it("answers 401 before looking at the product or body, so nothing is revealed", async () => {
    expect((await putItem(undefined, "no-such-product", { quantity: 0 })).status).toBe(401);
    expect((await deleteItem(undefined, "no-such-product")).status).toBe(401);
  });

  it("also works for an admin, who has their own cart", async () => {
    const admin = await createUserWithToken(context, "ADMIN");
    const product = await newProduct();

    expect((await putItem(admin.authorization, product.id, { quantity: 1 })).status).toBe(200);
    expect((await getCart(alice.authorization)).body.data.cart.itemCount).toBe(0);
  });
});

describe("GET /api/cart", () => {
  it("returns an empty cart for a new member", async () => {
    const response = await getCart(alice.authorization);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { cart: { items: [], itemCount: 0, totalQuantity: 0, totalPrice: 0 } },
    });
  });

  it("lists items oldest first with the documented shape", async () => {
    const first = await newProduct({ name: "先加入", price: 580 });
    const second = await newProduct({ name: "後加入", price: 120 });
    await putItem(alice.authorization, first.id, { quantity: 2 });
    await putItem(alice.authorization, second.id, { quantity: 3 });

    const { cart } = (await getCart(alice.authorization)).body.data;

    expect(cart.items[0]).toEqual({
      product: {
        id: first.id,
        name: "先加入",
        price: 580,
        imageUrl: expect.any(String),
        category: { id: category.id, name: "收納" },
      },
      quantity: 2,
      subtotal: 1160,
      available: true,
    });
    expect(cart.items.map((item: { product: { name: string } }) => item.product.name)).toEqual([
      "先加入",
      "後加入",
    ]);
    expect(cart).toMatchObject({ itemCount: 2, totalQuantity: 5, totalPrice: 1520 });
  });

  it("does not change the order when an existing item's quantity is updated", async () => {
    const first = await newProduct({ name: "先加入" });
    const second = await newProduct({ name: "後加入" });
    await putItem(alice.authorization, first.id, { quantity: 1 });
    await putItem(alice.authorization, second.id, { quantity: 1 });
    await putItem(alice.authorization, first.id, { quantity: 9 });

    const names = (await getCart(alice.authorization)).body.data.cart.items.map(
      (item: { product: { name: string } }) => item.product.name,
    );
    expect(names).toEqual(["先加入", "後加入"]);
  });

  it("never exposes user ids, deletedAt or internal ids", async () => {
    const product = await newProduct();
    await putItem(alice.authorization, product.id, { quantity: 1 });

    const raw = JSON.stringify((await getCart(alice.authorization)).body);
    expect(raw).not.toContain("deletedAt");
    expect(raw).not.toContain(alice.userId);
  });

  it("reflects a price change immediately, since prices are not snapshotted", async () => {
    const product = await newProduct({ price: 100 });
    await putItem(alice.authorization, product.id, { quantity: 2 });
    await prisma.product.update({ where: { id: product.id }, data: { price: 150 } });

    const { cart } = (await getCart(alice.authorization)).body.data;
    expect(cart.items[0].subtotal).toBe(300);
    expect(cart.totalPrice).toBe(300);
  });
});

describe("PUT /api/cart/items/:productId", () => {
  it("adds a new product and returns the whole cart", async () => {
    const product = await newProduct({ price: 580 });
    const response = await putItem(alice.authorization, product.id, { quantity: 2 });

    expect(response.status).toBe(200);
    expect(response.body.data.cart).toMatchObject({
      itemCount: 1,
      totalQuantity: 2,
      totalPrice: 1160,
    });
    expect(await prisma.cartItem.count({ where: { userId: alice.userId } })).toBe(1);
  });

  it("is idempotent: sending the same request twice leaves one row and the same quantity", async () => {
    const product = await newProduct();
    const first = await putItem(alice.authorization, product.id, { quantity: 3 });
    const second = await putItem(alice.authorization, product.id, { quantity: 3 });

    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(await prisma.cartItem.count()).toBe(1);
  });

  it("sets the quantity instead of accumulating it", async () => {
    const product = await newProduct();
    await putItem(alice.authorization, product.id, { quantity: 5 });
    const response = await putItem(alice.authorization, product.id, { quantity: 2 });

    expect(response.body.data.cart.items[0].quantity).toBe(2);
  });

  it("accepts the boundary quantities 1 and 99", async () => {
    const product = await newProduct();

    expect((await putItem(alice.authorization, product.id, { quantity: 1 })).status).toBe(200);
    expect((await putItem(alice.authorization, product.id, { quantity: 99 })).status).toBe(200);
  });

  it.each([
    ["zero", { quantity: 0 }],
    ["negative", { quantity: -1 }],
    ["decimal", { quantity: 1.5 }],
    ["above 99", { quantity: 100 }],
    ["a string", { quantity: "2" }],
    ["null", { quantity: null }],
    ["missing", {}],
    ["an undeclared userId", { quantity: 1, userId: "someone-else" }],
    ["an undeclared price", { quantity: 1, price: 1 }],
  ])("rejects %s with 400 and writes nothing", async (_label, body) => {
    const product = await newProduct();
    const response = await putItem(alice.authorization, product.id, body);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(await prisma.cartItem.count()).toBe(0);
  });

  it("rejects an empty or malformed JSON body", async () => {
    const product = await newProduct();
    const empty = await request(app)
      .put(`/api/cart/items/${product.id}`)
      .set("Authorization", alice.authorization);
    const malformed = await request(app)
      .put(`/api/cart/items/${product.id}`)
      .set("Authorization", alice.authorization)
      .set("Content-Type", "application/json")
      .send("{ broken");

    expect(empty.status).toBe(400);
    expect(malformed.status).toBe(400);
  });

  it.each([
    ["does not exist", "no-such-product"],
    ["has an id that is too long", "x".repeat(101)],
  ])("returns 404 when the product %s", async (_label, productId) => {
    const response = await putItem(alice.authorization, productId, { quantity: 1 });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 for a soft-deleted product", async () => {
    const product = await newProduct({ deletedAt: new Date() });
    expect((await putItem(alice.authorization, product.id, { quantity: 1 })).status).toBe(404);
    expect(await prisma.cartItem.count()).toBe(0);
  });

  it("ignores any user identity the client tries to supply", async () => {
    const product = await newProduct();
    await request(app)
      .put(`/api/cart/items/${product.id}?userId=${bob.userId}`)
      .set("Authorization", alice.authorization)
      .set("X-User-Id", bob.userId)
      .send({ quantity: 1 });

    expect(await prisma.cartItem.count({ where: { userId: alice.userId } })).toBe(1);
    expect(await prisma.cartItem.count({ where: { userId: bob.userId } })).toBe(0);
  });

  it("returns 401 when the token is valid but the user no longer exists", async () => {
    const product = await newProduct();
    await prisma.user.delete({ where: { id: alice.userId } });

    expect((await putItem(alice.authorization, product.id, { quantity: 1 })).status).toBe(401);
  });
});

describe("cart capacity", () => {
  async function fillCart(authorization: string, count: number): Promise<string[]> {
    const productIds: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const product = await newProduct();
      productIds.push(product.id);
    }
    await prisma.cartItem.createMany({
      data: productIds.map((productId) => ({
        userId: authorization === alice.authorization ? alice.userId : bob.userId,
        productId,
        quantity: 1,
      })),
    });
    return productIds;
  }

  it(`rejects the ${MAX_CART_ITEMS + 1}th distinct product with 400`, async () => {
    await fillCart(alice.authorization, MAX_CART_ITEMS);
    const extra = await newProduct();

    const response = await putItem(alice.authorization, extra.id, { quantity: 1 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details[0].message).toContain(String(MAX_CART_ITEMS));
    expect(await prisma.cartItem.count({ where: { userId: alice.userId } })).toBe(MAX_CART_ITEMS);
  });

  it("still lets the member change the quantity of an existing item when the cart is full", async () => {
    const [firstId] = await fillCart(alice.authorization, MAX_CART_ITEMS);
    const response = await putItem(alice.authorization, firstId!, { quantity: 7 });

    expect(response.status).toBe(200);
  });

  it("lets a full cart accept a new product after one is removed", async () => {
    const [firstId] = await fillCart(alice.authorization, MAX_CART_ITEMS);
    await deleteItem(alice.authorization, firstId!);
    const extra = await newProduct();

    expect((await putItem(alice.authorization, extra.id, { quantity: 1 })).status).toBe(200);
  });

  it("keeps the limit per member", async () => {
    await fillCart(alice.authorization, MAX_CART_ITEMS);
    const product = await newProduct();

    expect((await putItem(bob.authorization, product.id, { quantity: 1 })).status).toBe(200);
  });

  it("never exceeds the limit when several different products are added concurrently", async () => {
    await fillCart(alice.authorization, MAX_CART_ITEMS - 2);
    const contenders = await Promise.all(Array.from({ length: 6 }, () => newProduct()));

    const responses = await Promise.all(
      contenders.map((product) => putItem(alice.authorization, product.id, { quantity: 1 })),
    );

    const succeeded = responses.filter((response) => response.status === 200).length;
    expect(succeeded).toBe(2);
    expect(responses.filter((response) => response.status === 400)).toHaveLength(4);
    expect(await prisma.cartItem.count({ where: { userId: alice.userId } })).toBe(MAX_CART_ITEMS);
  });
});

describe("concurrency", () => {
  it("keeps a single row when the same product is added concurrently", async () => {
    const product = await newProduct();

    const responses = await Promise.all(
      [1, 2, 3, 4, 5].map((quantity) => putItem(alice.authorization, product.id, { quantity })),
    );

    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(await prisma.cartItem.count({ where: { userId: alice.userId } })).toBe(1);
  });
});

describe("DELETE /api/cart/items/:productId", () => {
  it("removes the item and returns the remaining cart", async () => {
    const keep = await newProduct({ name: "保留" });
    const drop = await newProduct({ name: "移除" });
    await putItem(alice.authorization, keep.id, { quantity: 1 });
    await putItem(alice.authorization, drop.id, { quantity: 1 });

    const response = await deleteItem(alice.authorization, drop.id);

    expect(response.status).toBe(200);
    expect(
      response.body.data.cart.items.map((item: { product: { name: string } }) => item.product.name),
    ).toEqual(["保留"]);
  });

  it("returns 404 when removing the same item again", async () => {
    const product = await newProduct();
    await putItem(alice.authorization, product.id, { quantity: 1 });
    await deleteItem(alice.authorization, product.id);

    const response = await deleteItem(alice.authorization, product.id);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 for a product that is not in the cart", async () => {
    const product = await newProduct();
    expect((await deleteItem(alice.authorization, product.id)).status).toBe(404);
    expect((await deleteItem(alice.authorization, "no-such-product")).status).toBe(404);
  });
});

describe("isolation between members", () => {
  it("keeps each member's cart separate even for the same product", async () => {
    const product = await newProduct();
    await putItem(alice.authorization, product.id, { quantity: 2 });
    await putItem(bob.authorization, product.id, { quantity: 5 });

    expect((await getCart(alice.authorization)).body.data.cart.items[0].quantity).toBe(2);
    expect((await getCart(bob.authorization)).body.data.cart.items[0].quantity).toBe(5);
  });

  it("does not let one member remove or see another member's item", async () => {
    const product = await newProduct();
    await putItem(alice.authorization, product.id, { quantity: 2 });

    expect((await deleteItem(bob.authorization, product.id)).status).toBe(404);
    expect((await getCart(bob.authorization)).body.data.cart.itemCount).toBe(0);
    expect((await getCart(alice.authorization)).body.data.cart.itemCount).toBe(1);
  });

  it("does not let one member change another member's quantity", async () => {
    const product = await newProduct();
    await putItem(alice.authorization, product.id, { quantity: 2 });
    await putItem(bob.authorization, product.id, { quantity: 9 });

    expect((await getCart(alice.authorization)).body.data.cart.items[0].quantity).toBe(2);
  });
});

describe("products deleted after being added", () => {
  async function cartWithOneDeletedProduct() {
    const stays = await newProduct({ price: 100 });
    const goes = await newProduct({ price: 900 });
    await putItem(alice.authorization, stays.id, { quantity: 2 });
    await putItem(alice.authorization, goes.id, { quantity: 5 });
    await prisma.product.update({ where: { id: goes.id }, data: { deletedAt: new Date() } });
    return { stays, goes };
  }

  it("keeps the item but marks it unavailable and excludes it from totals", async () => {
    const { goes } = await cartWithOneDeletedProduct();
    const { cart } = (await getCart(alice.authorization)).body.data;

    const goneItem = cart.items.find(
      (item: { product: { id: string } }) => item.product.id === goes.id,
    );
    expect(goneItem).toMatchObject({ available: false, quantity: 5, subtotal: 4500 });
    expect(cart).toMatchObject({ itemCount: 2, totalQuantity: 2, totalPrice: 200 });
  });

  it("lets the member remove an unavailable item", async () => {
    const { goes } = await cartWithOneDeletedProduct();
    const response = await deleteItem(alice.authorization, goes.id);

    expect(response.status).toBe(200);
    expect(response.body.data.cart.itemCount).toBe(1);
  });

  it("refuses to change the quantity of an unavailable item with 404", async () => {
    const { goes } = await cartWithOneDeletedProduct();
    expect((await putItem(alice.authorization, goes.id, { quantity: 1 })).status).toBe(404);
  });
});

describe("database constraints", () => {
  it("rejects quantities outside 1..99", async () => {
    const product = await newProduct();
    const create = (quantity: number) =>
      prisma.cartItem.create({ data: { userId: alice.userId, productId: product.id, quantity } });

    await expect(create(0)).rejects.toThrow();
    await expect(create(100)).rejects.toThrow();
    await expect(create(-1)).rejects.toThrow();
  });

  it("rejects a second row for the same member and product", async () => {
    const product = await newProduct();
    const data = { userId: alice.userId, productId: product.id, quantity: 1 };
    await prisma.cartItem.create({ data });

    await expect(prisma.cartItem.create({ data })).rejects.toThrow();
  });

  it("deletes a member's cart items when the member is deleted", async () => {
    const product = await newProduct();
    await putItem(alice.authorization, product.id, { quantity: 1 });
    await prisma.user.delete({ where: { id: alice.userId } });

    expect(await prisma.cartItem.count()).toBe(0);
  });

  it("refuses to hard delete a product that is in someone's cart", async () => {
    const product = await newProduct();
    await putItem(alice.authorization, product.id, { quantity: 1 });

    await expect(prisma.product.delete({ where: { id: product.id } })).rejects.toThrow();
  });
});
