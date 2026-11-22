import type { PrismaClient } from "../../src/models/prisma-postgres-client.js";
import type { UserRole } from "../../src/models/user-role.js";
import type { TestContext } from "./test-app.js";

export interface ProductOverrides {
  readonly id?: string;
  readonly name?: string;
  readonly description?: string;
  readonly price?: number;
  readonly imageUrl?: string;
  readonly categoryId: string;
  readonly createdAt?: Date;
  readonly deletedAt?: Date | null;
}

let sequence = 0;

export async function createCategory(prisma: PrismaClient, name: string) {
  return prisma.category.create({ data: { name } });
}

export async function createProduct(prisma: PrismaClient, overrides: ProductOverrides) {
  sequence += 1;
  const { categoryId, ...rest } = overrides;
  return prisma.product.create({
    data: {
      name: `商品 ${sequence}`,
      description: `商品 ${sequence} 的說明`,
      price: 100,
      imageUrl: "https://images.example.com/item.jpg",
      categoryId,
      ...rest,
    },
  });
}

/**
 * 直接建立使用者並簽發 token，避免每個測試都花時間做 bcrypt。
 */
export async function createUserWithToken(
  context: TestContext,
  role: UserRole,
): Promise<{ readonly userId: string; readonly authorization: string }> {
  sequence += 1;
  const user = await context.prisma.user.create({
    data: {
      email: `${role.toLowerCase()}-${sequence}@example.com`,
      passwordHash: "x",
      name: role,
      role,
    },
  });
  const token = context.services.tokenService.issue({ userId: user.id, role });
  return { userId: user.id, authorization: `Bearer ${token}` };
}
