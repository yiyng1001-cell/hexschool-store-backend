import "dotenv/config";
import { defineConfig } from "prisma/config";

// migration 一律使用直連網址；Neon 的連線池網址不適合執行 migration。
const migrationDatabaseUrl = process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"];

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --env-file-if-exists=.env prisma/seed.ts",
  },
  datasource: {
    url: migrationDatabaseUrl,
  },
});
