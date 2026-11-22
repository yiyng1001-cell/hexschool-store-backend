import { Prisma } from "../generated/prisma/client.js";
import type { PrismaClient } from "./prisma-postgres-client.js";
import type { UserRole } from "./user-role.js";

export interface UserRecord {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly name: string;
  readonly role: UserRole;
  readonly createdAt: Date;
}

/**
 * 註冊永遠建立一般會員，因此刻意不提供 `role` 欄位（S-3）。
 */
export interface NewUser {
  readonly email: string;
  readonly passwordHash: string;
  readonly name: string;
}

export type CreateUserResult =
  | { readonly ok: true; readonly user: UserRecord }
  | { readonly ok: false; readonly reason: "EMAIL_TAKEN" };

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(newUser: NewUser): Promise<CreateUserResult>;
}

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_CONSTRAINT_VIOLATION
  );
}

export function createPrismaUserRepository(prisma: PrismaClient): UserRepository {
  return {
    findByEmail: (email) => prisma.user.findUnique({ where: { email } }),
    findById: (id) => prisma.user.findUnique({ where: { id } }),
    async create(newUser) {
      try {
        const user = await prisma.user.create({ data: { ...newUser } });
        return { ok: true, user };
      } catch (error) {
        if (isUniqueConstraintViolation(error)) {
          return { ok: false, reason: "EMAIL_TAKEN" };
        }
        throw error;
      }
    },
  };
}
