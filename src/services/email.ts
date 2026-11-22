/**
 * email 不分大小寫且忽略頭尾空白；註冊、登入與 schema 都使用同一個正規化函式。
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
