import { describe, expect, it } from "vitest";
import { escapeLikePattern } from "../../src/models/like-pattern.js";

describe("escapeLikePattern", () => {
  it.each([
    ["%", "\\%"],
    ["_", "\\_"],
    ["\\", "\\\\"],
    ["100%_off", "100\\%\\_off"],
    ["a\\%b", "a\\\\\\%b"],
    ["純棉", "純棉"],
    ["", ""],
  ])("escapes %j to %j", (input, expected) => {
    expect(escapeLikePattern(input)).toBe(expected);
  });

  it("leaves ordinary text untouched", () => {
    expect(escapeLikePattern("LED lamp 木質")).toBe("LED lamp 木質");
  });
});
