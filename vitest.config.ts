import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/support/global-setup.ts"],
    // 整合測試共用同一個測試資料庫並會清空資料表，因此檔案之間不可平行執行。
    fileParallelism: false,
    // 讓測試讀得到 .env 中不帶 VITE_ 前綴的變數（如 TEST_DATABASE_URL）。
    env: loadEnv(mode, process.cwd(), ""),
  },
}));
