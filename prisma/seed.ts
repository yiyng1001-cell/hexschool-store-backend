import { createPrismaPostgresClient } from "../src/models/prisma-postgres-client.js";
import { createBcryptPasswordHasher } from "../src/services/password.service.js";
import { buildSeedUserSpecs, seedUsers, SeedConfigError } from "./seed-users.js";

async function main(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
    throw new SeedConfigError(["DATABASE_URL"]);
  }

  const specs = buildSeedUserSpecs(process.env);
  const prisma = createPrismaPostgresClient(databaseUrl);
  try {
    await seedUsers(prisma, createBcryptPasswordHasher(), specs);
    console.log(JSON.stringify({ level: "info", msg: "seeded users", count: specs.length }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof SeedConfigError ? error.message : "seed failed";
  console.error(JSON.stringify({ level: "fatal", msg: message }));
  if (!(error instanceof SeedConfigError)) console.error(error);
  process.exit(1);
});
