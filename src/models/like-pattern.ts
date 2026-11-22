const LIKE_SPECIAL_CHARACTERS = /[\\%_]/g;

/**
 * Prisma 的 `contains` 不會跳脫 SQL LIKE 的萬用字元，使用者輸入 `%` 或 `_` 會比對到所有資料。
 * PostgreSQL 的 LIKE 預設以反斜線作為跳脫字元，因此在每個特殊字元前加上反斜線，使其成為一般字元。
 */
export function escapeLikePattern(keyword: string): string {
  return keyword.replace(LIKE_SPECIAL_CHARACTERS, "\\$&");
}
