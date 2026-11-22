import { describe, expect, it } from "vitest";
import { assertLocalTestDatabaseUrl } from "../support/test-database.js";

describe("assertLocalTestDatabaseUrl", () => {
  it.each([
    "postgresql://u:p@localhost:5432/store_test",
    "postgresql://u:p@127.0.0.1:5432/store_test",
    "postgresql://u:p@[::1]:5432/store_test",
  ])("accepts local host %s", (url) => {
    expect(assertLocalTestDatabaseUrl(url)).toBe(url);
  });

  it("rejects a remote host such as Neon", () => {
    expect(() =>
      assertLocalTestDatabaseUrl("postgresql://u:p@ep-cool-123.us-east-2.aws.neon.tech/db"),
    ).toThrow("local database host");
  });

  it("rejects a host that merely starts with localhost", () => {
    expect(() => assertLocalTestDatabaseUrl("postgresql://u:p@localhost.evil.example/db")).toThrow(
      "local database host",
    );
  });

  it.each([undefined, "", "   ", "not a url"])("rejects missing or invalid value %j", (value) => {
    expect(() => assertLocalTestDatabaseUrl(value)).toThrow();
  });

  it("never includes the connection string or password in the error message", () => {
    try {
      assertLocalTestDatabaseUrl("postgresql://admin:hunter2@prod.example.com/db");
      expect.unreachable("should have thrown");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain("hunter2");
      expect(message).not.toContain("prod.example.com");
    }
  });
});
