import { describe, expect, it } from "vitest";
import type { CartLineRecord } from "../../src/models/cart-item.model.js";
import { buildCartView } from "../../src/services/cart-summary.service.js";

function line(overrides: {
  id?: string;
  price?: number;
  quantity?: number;
  deletedAt?: Date | null;
}): CartLineRecord {
  return {
    quantity: overrides.quantity ?? 1,
    product: {
      id: overrides.id ?? "p1",
      name: "商品",
      price: overrides.price ?? 100,
      imageUrl: "https://images.example.com/a.jpg",
      deletedAt: overrides.deletedAt ?? null,
      category: { id: "c1", name: "分類" },
    },
  };
}

describe("buildCartView", () => {
  it("returns zeros for an empty cart", () => {
    expect(buildCartView([])).toEqual({ items: [], itemCount: 0, totalQuantity: 0, totalPrice: 0 });
  });

  it("computes subtotals and totals for purchasable items", () => {
    const view = buildCartView([
      line({ id: "a", price: 580, quantity: 2 }),
      line({ id: "b", price: 120, quantity: 3 }),
    ]);

    expect(view.items.map((item) => item.subtotal)).toEqual([1160, 360]);
    expect(view.itemCount).toBe(2);
    expect(view.totalQuantity).toBe(5);
    expect(view.totalPrice).toBe(1520);
  });

  it("lists unavailable items with a subtotal but excludes them from the totals", () => {
    const view = buildCartView([
      line({ id: "a", price: 100, quantity: 2 }),
      line({ id: "gone", price: 900, quantity: 5, deletedAt: new Date("2026-11-20") }),
    ]);

    expect(view.items[1]).toMatchObject({ available: false, subtotal: 4500 });
    expect(view.itemCount).toBe(2);
    expect(view.totalQuantity).toBe(2);
    expect(view.totalPrice).toBe(200);
  });

  it("never exposes deletedAt on a product", () => {
    const view = buildCartView([line({ deletedAt: new Date() })]);
    expect(JSON.stringify(view)).not.toContain("deletedAt");
  });

  it("stays exact at the largest possible values (99 x 1,000,000 x 50 items)", () => {
    const lines = Array.from({ length: 50 }, (_, index) =>
      line({ id: `p${index}`, price: 1_000_000, quantity: 99 }),
    );
    const view = buildCartView(lines);

    expect(view.totalPrice).toBe(50 * 99 * 1_000_000);
    expect(Number.isSafeInteger(view.totalPrice)).toBe(true);
    expect(view.totalQuantity).toBe(50 * 99);
  });

  it("keeps the order it was given and does not mutate its input", () => {
    const lines = Object.freeze([line({ id: "z" }), line({ id: "a" })]);
    expect(buildCartView(lines).items.map((item) => item.product.id)).toEqual(["z", "a"]);
  });

  it("reports an all-unavailable cart as having items but a zero total", () => {
    const view = buildCartView([line({ deletedAt: new Date() }), line({ deletedAt: new Date() })]);
    expect(view).toMatchObject({ itemCount: 2, totalQuantity: 0, totalPrice: 0 });
  });
});
