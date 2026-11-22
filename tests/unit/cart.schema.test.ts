import { describe, expect, it } from "vitest";
import { toValidationDetails } from "../../src/middlewares/validate.js";
import { setCartItemBodySchema } from "../../src/schemas/cart.schema.js";

describe("setCartItemBodySchema", () => {
  it.each([1, 2, 50, 99])("accepts quantity %i", (quantity) => {
    expect(setCartItemBodySchema.parse({ quantity })).toEqual({ quantity });
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["decimal", 1.5],
    ["above the maximum", 100],
    ["numeric string", "2"],
    ["null", null],
    ["boolean", true],
    ["array", [1]],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["a huge number", 1e21],
  ])("rejects a %s quantity", (_label, quantity) => {
    expect(setCartItemBodySchema.safeParse({ quantity }).success).toBe(false);
  });

  it("rejects a missing quantity and names the field", () => {
    const result = setCartItemBodySchema.safeParse({});
    if (result.success) throw new Error("expected failure");
    expect(toValidationDetails(result.error.issues).map((detail) => detail.field)).toEqual([
      "quantity",
    ]);
  });

  it.each(["userId", "price", "productId", "id"])(
    "rejects the client-supplied field %s",
    (field) => {
      const result = setCartItemBodySchema.safeParse({ quantity: 1, [field]: "x" });
      if (result.success) throw new Error("expected failure");
      expect(toValidationDetails(result.error.issues)).toContainEqual({
        field,
        message: "不允許的欄位",
      });
    },
  );

  it.each([undefined, null, "text", 5, []])("rejects a non-object body %j", (body) => {
    expect(setCartItemBodySchema.safeParse(body).success).toBe(false);
  });

  it("points users who want to remove an item to DELETE", () => {
    const result = setCartItemBodySchema.safeParse({ quantity: 0 });
    if (result.success) throw new Error("expected failure");
    expect(result.error.issues[0]?.message).toContain("DELETE");
  });
});
