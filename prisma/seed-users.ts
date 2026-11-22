import { z } from "zod";
import type { PrismaClient } from "../src/models/prisma-postgres-client.js";
import type { UserRole } from "../src/models/user-role.js";
import { passwordSchema } from "../src/schemas/auth.schema.js";
import { normalizeEmail } from "../src/services/email.js";
import type { PasswordHasher } from "../src/services/password.service.js";

export interface SeedUserSpec {
  readonly email: string;
  readonly name: string;
  readonly password: string;
  readonly role: UserRole;
}

/**
 * 公開的示範會員，帳密會寫在 README 供審核者使用，不是機密。
 * 管理員帳密則只來自環境變數。
 */
export const DEMO_MEMBER: SeedUserSpec = {
  email: "member@example.com",
  name: "示範會員",
  password: "Member12345",
  role: "USER",
};

const adminEnvSchema = z.object({
  ADMIN_EMAIL: z.string().transform(normalizeEmail).pipe(z.email()),
  ADMIN_PASSWORD: passwordSchema,
});

export class SeedConfigError extends Error {
  constructor(invalidVariables: readonly string[]) {
    super(`seed 所需的環境變數不合法或缺少：${invalidVariables.join(", ")}`);
    this.name = "SeedConfigError";
  }
}

export function buildSeedUserSpecs(
  source: Readonly<Record<string, string | undefined>>,
): readonly SeedUserSpec[] {
  const parsed = adminEnvSchema.safeParse(source);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => String(issue.path[0] ?? "unknown"));
    throw new SeedConfigError([...new Set(names)]);
  }
  const admin: SeedUserSpec = {
    email: parsed.data.ADMIN_EMAIL,
    name: "管理員",
    password: parsed.data.ADMIN_PASSWORD,
    role: "ADMIN",
  };
  return [admin, DEMO_MEMBER];
}

/**
 * 以 email 為鍵做 upsert，重複執行不會產生重複帳號（D-3）。
 */
export async function seedUsers(
  prisma: PrismaClient,
  passwords: PasswordHasher,
  specs: readonly SeedUserSpec[],
): Promise<void> {
  for (const spec of specs) {
    const passwordHash = await passwords.hash(spec.password);
    await prisma.user.upsert({
      where: { email: normalizeEmail(spec.email) },
      create: {
        email: normalizeEmail(spec.email),
        name: spec.name,
        passwordHash,
        role: spec.role,
      },
      update: { name: spec.name, passwordHash, role: spec.role },
    });
  }
}
