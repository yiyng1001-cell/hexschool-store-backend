import { describe, expect, it } from "vitest";
import { toValidationDetails } from "../../src/middlewares/validate.js";
import { loginBodySchema, registerBodySchema } from "../../src/schemas/auth.schema.js";

const VALID_REGISTER = { email: "user@example.com", password: "Passw0rdOk", name: "小明" };

function detailsFor(schema: typeof registerBodySchema | typeof loginBodySchema, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) throw new Error("expected validation to fail");
  return toValidationDetails(result.error.issues);
}

describe("registerBodySchema", () => {
  it("accepts a valid body and normalizes email and name", () => {
    const parsed = registerBodySchema.parse({
      email: "  User@Example.COM ",
      password: "Passw0rdOk",
      name: "  小明  ",
    });
    expect(parsed).toEqual({ email: "user@example.com", password: "Passw0rdOk", name: "小明" });
  });

  it("does not alter the password", () => {
    expect(registerBodySchema.parse({ ...VALID_REGISTER, password: " Passw0rd 1 " }).password).toBe(
      " Passw0rd 1 ",
    );
  });

  it.each([
    ["short", "Pass1", "至少 8 字元"],
    ["no digit", "Password", "需包含數字"],
    ["no letter", "12345678", "需包含英文字母"],
  ])("rejects a %s password", (_label, password, message) => {
    expect(detailsFor(registerBodySchema, { ...VALID_REGISTER, password })).toContainEqual({
      field: "password",
      message,
    });
  });

  it("accepts a password of exactly 72 bytes and rejects 73", () => {
    expect(
      registerBodySchema.safeParse({ ...VALID_REGISTER, password: `a1${"x".repeat(70)}` }).success,
    ).toBe(true);
    expect(
      registerBodySchema.safeParse({ ...VALID_REGISTER, password: `a1${"x".repeat(71)}` }).success,
    ).toBe(false);
  });

  it("counts bytes, not characters, for the length limit", () => {
    const multibyte = `a1${"密".repeat(24)}`; // 26 characters but 74 bytes
    expect(multibyte.length).toBeLessThan(72);
    expect(registerBodySchema.safeParse({ ...VALID_REGISTER, password: multibyte }).success).toBe(
      false,
    );
  });

  it.each(["", "not-an-email", "a@b", "user@", "@example.com", "us er@example.com"])(
    "rejects invalid email %j",
    (email) => {
      expect(detailsFor(registerBodySchema, { ...VALID_REGISTER, email })[0]?.field).toBe("email");
    },
  );

  it("rejects an email longer than 254 characters", () => {
    const email = `${"a".repeat(250)}@example.com`;
    expect(registerBodySchema.safeParse({ ...VALID_REGISTER, email }).success).toBe(false);
  });

  it.each(["", "   ", "x".repeat(51)])("rejects invalid name %j", (name) => {
    expect(detailsFor(registerBodySchema, { ...VALID_REGISTER, name })[0]?.field).toBe("name");
  });

  it.each([
    ["role", { role: "ADMIN" }],
    ["isAdmin", { isAdmin: true }],
    ["id", { id: "forced-id" }],
  ])("rejects the undeclared field %s and names it", (field, extra) => {
    expect(detailsFor(registerBodySchema, { ...VALID_REGISTER, ...extra })).toContainEqual({
      field,
      message: "不允許的欄位",
    });
  });

  it.each([undefined, null, "text", 42, []])("rejects a non-object body %j", (body) => {
    expect(detailsFor(registerBodySchema, body).length).toBeGreaterThan(0);
  });

  it("reports every missing field", () => {
    const fields = detailsFor(registerBodySchema, {}).map((detail) => detail.field);
    expect(fields).toEqual(expect.arrayContaining(["email", "password", "name"]));
  });

  it("rejects non-string values instead of coercing them", () => {
    expect(registerBodySchema.safeParse({ ...VALID_REGISTER, password: 12345678 }).success).toBe(
      false,
    );
    expect(registerBodySchema.safeParse({ ...VALID_REGISTER, name: 123 }).success).toBe(false);
  });
});

describe("loginBodySchema", () => {
  it("accepts any non-empty password without applying registration rules", () => {
    expect(loginBodySchema.safeParse({ email: "user@example.com", password: "weak" }).success).toBe(
      true,
    );
  });

  it("normalizes email", () => {
    expect(loginBodySchema.parse({ email: " USER@example.com", password: "x" }).email).toBe(
      "user@example.com",
    );
  });

  it("rejects an empty password and an over-long one", () => {
    expect(loginBodySchema.safeParse({ email: "user@example.com", password: "" }).success).toBe(
      false,
    );
    expect(
      loginBodySchema.safeParse({ email: "user@example.com", password: "x".repeat(73) }).success,
    ).toBe(false);
  });

  it("rejects undeclared fields", () => {
    expect(
      detailsFor(loginBodySchema, { email: "user@example.com", password: "x", role: "ADMIN" }),
    ).toContainEqual({
      field: "role",
      message: "不允許的欄位",
    });
  });
});
