import { describe, expect, it, vi } from "vitest";
import { NotFoundError, UnauthorizedError, ValidationError } from "../../src/errors/http-errors.js";
import type {
  CartLineRecord,
  CartRepository,
  SetQuantityResult,
} from "../../src/models/cart-item.model.js";
import { createCartService } from "../../src/services/cart.service.js";

const LINE: CartLineRecord = {
  quantity: 2,
  product: {
    id: "p1",
    name: "木質收納盒",
    price: 580,
    imageUrl: "https://images.example.com/box.jpg",
    deletedAt: null,
    category: { id: "c1", name: "收納" },
  },
};

function stubRepository(overrides: Partial<CartRepository> = {}): CartRepository {
  return {
    listByUser: vi.fn(async () => [LINE]),
    setQuantity: vi.fn(async (): Promise<SetQuantityResult> => ({ ok: true })),
    remove: vi.fn(async () => true),
    ...overrides,
  };
}

const failWith = (reason: Extract<SetQuantityResult, { ok: false }>["reason"]) =>
  vi.fn(async (): Promise<SetQuantityResult> => ({ ok: false, reason }));

describe("getCart", () => {
  it("builds the view from the repository lines", async () => {
    const cart = await createCartService(stubRepository()).getCart("u1");
    expect(cart).toMatchObject({ itemCount: 1, totalQuantity: 2, totalPrice: 1160 });
  });
});

describe("setItemQuantity", () => {
  it("writes the quantity for the given user and product and returns the fresh cart", async () => {
    const carts = stubRepository();
    const cart = await createCartService(carts).setItemQuantity("u1", "p1", 2);

    expect(carts.setQuantity).toHaveBeenCalledWith("u1", "p1", 2);
    expect(carts.listByUser).toHaveBeenCalledWith("u1");
    expect(cart.items).toHaveLength(1);
  });

  it("maps a missing or deleted product to NotFoundError and does not read the cart", async () => {
    const carts = stubRepository({ setQuantity: failWith("PRODUCT_NOT_FOUND") });

    await expect(createCartService(carts).setItemQuantity("u1", "p1", 1)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(carts.listByUser).not.toHaveBeenCalled();
  });

  it("maps a full cart to a ValidationError that explains the limit", async () => {
    const carts = stubRepository({ setQuantity: failWith("CART_FULL") });
    const failure = await createCartService(carts)
      .setItemQuantity("u1", "p1", 1)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ValidationError);
    expect((failure as ValidationError).details?.[0]?.message).toContain("50");
  });

  it("treats a token for a vanished user as unauthorized", async () => {
    const carts = stubRepository({ setQuantity: failWith("USER_NOT_FOUND") });
    await expect(createCartService(carts).setItemQuantity("u1", "p1", 1)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });
});

describe("removeItem", () => {
  it("returns the cart after removal", async () => {
    const carts = stubRepository({ listByUser: vi.fn(async () => []) });
    const cart = await createCartService(carts).removeItem("u1", "p1");

    expect(carts.remove).toHaveBeenCalledWith("u1", "p1");
    expect(cart.itemCount).toBe(0);
  });

  it("throws NotFoundError when the item is not in the cart, which covers repeated removal", async () => {
    const carts = stubRepository({ remove: vi.fn(async () => false) });
    await expect(createCartService(carts).removeItem("u1", "p1")).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(carts.listByUser).not.toHaveBeenCalled();
  });
});
