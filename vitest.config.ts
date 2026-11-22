import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // 讓測試讀得到 .env 中不帶 VITE_ 前綴的變數（如 TEST_DATABASE_URL）。
    env: loadEnv(mode, process.cwd(), ""),
  },
}));
