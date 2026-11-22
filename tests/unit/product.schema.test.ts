import { describe, expect, it } from "vitest";
import { toValidationDetails } from "../../src/middlewares/validate.js";
import {
  createProductBodySchema,
  productListQuerySchema,
  updateProductBodySchema,
} from "../../src/schemas/product.schema.js";

const VALID_PRODUCT = {
  name: "木質收納盒",
  description: "桌面小物收納，天然橡木。",
  price: 580,
  imageUrl: "https://images.example.com/box.jpg",
  categoryId: "category-1",
};

function fieldsOf(result: { success: boolean; error?: { issues: never[] } }) {
  if (result.success) throw new Error("expected validation to fail");
  return toValidationDetails(result.error?.issues ?? []).map((detail) => detail.field);
}

describe("productListQuerySchema", () => {
  it("applies defaults when no parameter is given", () => {
    expect(productListQuerySchema.parse({})).toEqual({ page: 1, limit: 12, sort: "newest" });
  });

  it("parses numeric strings, trims q and keeps category", () => {
    expect(
      productListQuerySchema.parse({
        page: "3",
        limit: "50",
        category: "cat-1",
        q: "  木質  ",
        sort: "price_desc",
      }),
    ).toEqual({ page: 3, limit: 50, category: "cat-1", q: "木質", sort: "price_desc" });
  });

  it.each([
    ["page", "0"],
    ["page", "-1"],
    ["page", "1.5"],
    ["page", "abc"],
    ["page", "1000001"],
    ["page", ""],
    ["limit", "0"],
    ["limit", "51"],
    ["limit", "2.5"],
    ["limit", "1e2"],
    ["sort", "foo"],
    ["sort", "NEWEST"],
    ["q", ""],
    ["q", "   "],
    ["q", "x".repeat(51)],
    ["category", ""],
    ["category", "x".repeat(101)],
  ])("rejects %s=%j", (name, value) => {
    expect(productListQuerySchema.safeParse({ [name]: value }).success).toBe(false);
  });

  it("rejects repeated parameters (array values) instead of picking one", () => {
    expect(productListQuerySchema.safeParse({ page: ["1", "2"] }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ q: ["a", "b"] }).success).toBe(false);
  });

  it("rejects unknown query parameters and names them", () => {
    const result = productListQuerySchema.safeParse({ page: "1", foo: "bar" });
    expect(fieldsOf(result as never)).toContain("foo");
  });

  it("accepts the boundary values", () => {
    expect(productListQuerySchema.safeParse({ page: "1", limit: "1" }).success).toBe(true);
    expect(productListQuerySchema.safeParse({ page: "1000000", limit: "50" }).success).toBe(true);
    expect(productListQuerySchema.safeParse({ q: "x".repeat(50) }).success).toBe(true);
  });
});

describe("createProductBodySchema", () => {
  it("accepts a valid body and trims text fields", () => {
    const parsed = createProductBodySchema.parse({
      ...VALID_PRODUCT,
      name: "  木質收納盒 ",
      description: " 說明 ",
    });
    expect(parsed.name).toBe("木質收納盒");
    expect(parsed.description).toBe("說明");
  });

  it.each([
    ["decimal", 580.5],
    ["zero", 0],
    ["negative", -1],
    ["above the maximum", 1_000_001],
    ["numeric string", "580"],
    ["null", null],
    ["NaN-like string", "abc"],
  ])("rejects a %s price", (_label, price) => {
    expect(createProductBodySchema.safeParse({ ...VALID_PRODUCT, price }).success).toBe(false);
  });

  it("accepts the price boundaries 1 and 1,000,000", () => {
    expect(createProductBodySchema.safeParse({ ...VALID_PRODUCT, price: 1 }).success).toBe(true);
    expect(createProductBodySchema.safeParse({ ...VALID_PRODUCT, price: 1_000_000 }).success).toBe(
      true,
    );
  });

  it.each([
    "http://images.example.com/box.jpg",
    "ftp://images.example.com/box.jpg",
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "//images.example.com/box.jpg",
    "images.example.com/box.jpg",
    "https://",
    "",
    "not a url",
  ])("rejects the image URL %j", (imageUrl) => {
    expect(createProductBodySchema.safeParse({ ...VALID_PRODUCT, imageUrl }).success).toBe(false);
  });

  it("rejects an image URL longer than 2048 characters", () => {
    const imageUrl = `https://images.example.com/${"a".repeat(2048)}`;
    expect(createProductBodySchema.safeParse({ ...VALID_PRODUCT, imageUrl }).success).toBe(false);
  });

  it.each(["name", "description", "price", "imageUrl", "categoryId"])("requires %s", (field) => {
    const rest = Object.fromEntries(Object.entries(VALID_PRODUCT).filter(([key]) => key !== field));
    expect(fieldsOf(createProductBodySchema.safeParse(rest) as never)).toContain(field);
  });

  it.each([
    ["name", "   "],
    ["name", "x".repeat(101)],
    ["description", ""],
    ["description", "x".repeat(2001)],
    ["categoryId", ""],
  ])("rejects %s=%j", (field, value) => {
    expect(createProductBodySchema.safeParse({ ...VALID_PRODUCT, [field]: value }).success).toBe(
      false,
    );
  });

  it.each(["id", "deletedAt", "createdAt", "category"])(
    "rejects the client-supplied field %s",
    (field) => {
      const result = createProductBodySchema.safeParse({ ...VALID_PRODUCT, [field]: "x" });
      expect(fieldsOf(result as never)).toContain(field);
    },
  );
});

describe("updateProductBodySchema", () => {
  it("accepts any single field", () => {
    expect(updateProductBodySchema.safeParse({ price: 520 }).success).toBe(true);
    expect(updateProductBodySchema.safeParse({ name: "新名稱" }).success).toBe(true);
  });

  it("rejects an empty object and reports it on the whole body", () => {
    const result = updateProductBodySchema.safeParse({});
    expect(fieldsOf(result as never)).toEqual(["body"]);
  });

  it("still validates the fields that are present", () => {
    expect(updateProductBodySchema.safeParse({ price: 0 }).success).toBe(false);
    expect(updateProductBodySchema.safeParse({ imageUrl: "http://x.example/a.png" }).success).toBe(
      false,
    );
  });

  it("rejects undeclared fields", () => {
    expect(updateProductBodySchema.safeParse({ price: 1, deletedAt: null }).success).toBe(false);
  });
});
