import { describe, expect, it } from "vitest";
import {
  buildPageMeta,
  MAX_PAGE,
  MAX_PAGE_LIMIT,
  toPageWindow,
} from "../../src/services/pagination.js";

describe("toPageWindow", () => {
  it.each([
    [
      { page: 1, limit: 12 },
      { skip: 0, take: 12 },
    ],
    [
      { page: 2, limit: 12 },
      { skip: 12, take: 12 },
    ],
    [
      { page: 3, limit: 50 },
      { skip: 100, take: 50 },
    ],
    [
      { page: 1, limit: 1 },
      { skip: 0, take: 1 },
    ],
  ])("maps %j to %j", (request, window) => {
    expect(toPageWindow(request)).toEqual(window);
  });

  it.each([
    { page: 0, limit: 12 },
    { page: -1, limit: 12 },
    { page: 1.5, limit: 12 },
    { page: MAX_PAGE + 1, limit: 12 },
    { page: 1, limit: 0 },
    { page: 1, limit: MAX_PAGE_LIMIT + 1 },
    { page: 1, limit: 2.5 },
    { page: Number.NaN, limit: 12 },
  ])("rejects out-of-range request %j", (request) => {
    expect(() => toPageWindow(request)).toThrow(RangeError);
  });
});

describe("buildPageMeta", () => {
  it.each([
    [0, 0],
    [1, 1],
    [12, 1],
    [13, 2],
    [24, 2],
    [25, 3],
  ])("computes totalPages for total %i", (total, totalPages) => {
    expect(buildPageMeta({ page: 1, limit: 12 }, total)).toEqual({
      page: 1,
      limit: 12,
      total,
      totalPages,
    });
  });

  it("rejects a negative or fractional total", () => {
    expect(() => buildPageMeta({ page: 1, limit: 12 }, -1)).toThrow(RangeError);
    expect(() => buildPageMeta({ page: 1, limit: 12 }, 1.5)).toThrow(RangeError);
  });
});
