import { execFileSync } from "node:child_process";
import { loadEnv } from "vite";
import { assertLocalTestDatabaseUrl } from "./test-database.js";

/**
 * 整合測試開始前，把專用測試資料庫套用到最新的 migration。
 * 全域設定跑在主程序，不會自動帶入 `.env`，因此在這裡明確載入；已存在的環境變數優先。
 */
export default function applyMigrationsToTestDatabase(): void {
  const env = { ...loadEnv("test", process.cwd(), ""), ...process.env };
  const testDatabaseUrl = assertLocalTestDatabaseUrl(env["TEST_DATABASE_URL"]);
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...env, DATABASE_URL: testDatabaseUrl, DIRECT_URL: testDatabaseUrl },
    stdio: "pipe",
  });
}
