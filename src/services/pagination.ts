export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_LIMIT = 12;
export const MAX_PAGE_LIMIT = 50;
// 避免極大的 page 造成不合理的 OFFSET。
export const MAX_PAGE = 1_000_000;

export interface PageRequest {
  readonly page: number;
  readonly limit: number;
}

export interface PageWindow {
  readonly skip: number;
  readonly take: number;
}

export interface PageMeta extends PageRequest {
  readonly total: number;
  readonly totalPages: number;
}

function assertValidPageRequest({ page, limit }: PageRequest): void {
  if (!Number.isInteger(page) || page < 1 || page > MAX_PAGE) {
    throw new RangeError(`page must be an integer between 1 and ${MAX_PAGE}`);
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_LIMIT) {
    throw new RangeError(`limit must be an integer between 1 and ${MAX_PAGE_LIMIT}`);
  }
}

export function toPageWindow(request: PageRequest): PageWindow {
  assertValidPageRequest(request);
  return { skip: (request.page - 1) * request.limit, take: request.limit };
}

export function buildPageMeta(request: PageRequest, total: number): PageMeta {
  assertValidPageRequest(request);
  if (!Number.isInteger(total) || total < 0) {
    throw new RangeError("total must be a non-negative integer");
  }
  return {
    page: request.page,
    limit: request.limit,
    total,
    totalPages: Math.ceil(total / request.limit),
  };
}
