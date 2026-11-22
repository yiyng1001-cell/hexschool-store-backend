import { describe, expect, it } from "vitest";
import { createBcryptPasswordHasher } from "../../src/services/password.service.js";

const hasher = createBcryptPasswordHasher(4);

describe("createBcryptPasswordHasher", () => {
  it("never stores the plain password", async () => {
    const hash = await hasher.hash("Passw0rdOk");
    expect(hash).not.toContain("Passw0rdOk");
    expect(hash).toMatch(/^\$2[aby]\$04\$/);
  });

  it("produces a different hash each time (salted)", async () => {
    const [first, second] = await Promise.all([
      hasher.hash("Passw0rdOk"),
      hasher.hash("Passw0rdOk"),
    ]);
    expect(first).not.toBe(second);
  });

  it("verifies the right password and rejects a wrong one", async () => {
    const hash = await hasher.hash("Passw0rdOk");
    await expect(hasher.verify("Passw0rdOk", hash)).resolves.toBe(true);
    await expect(hasher.verify("Passw0rdNo", hash)).resolves.toBe(false);
  });

  it("resolves when verifying against the decoy hash", async () => {
    await expect(hasher.verifyAgainstDecoy("anything")).resolves.toBeUndefined();
  });

  it.each([3, 32, 4.5, Number.NaN])("rejects invalid cost %s", (cost) => {
    expect(() => createBcryptPasswordHasher(cost)).toThrow(RangeError);
  });
});
