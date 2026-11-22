import { createPrismaCartRepository } from "./models/cart-item.model.js";
import { createPrismaCategoryRepository } from "./models/category.model.js";
import type { PrismaClient } from "./models/prisma-postgres-client.js";
import { createPrismaProductRepository } from "./models/product.model.js";
import { createPrismaUserRepository } from "./models/user.model.js";
import { createAuthService, type AuthService } from "./services/auth.service.js";
import { createCartService, type CartService } from "./services/cart.service.js";
import { createCategoryService, type CategoryService } from "./services/category.service.js";
import { createBcryptPasswordHasher } from "./services/password.service.js";
import { createProductService, type ProductService } from "./services/product.service.js";
import { createJwtTokenService, type TokenService } from "./services/token.service.js";

export interface CompositionOptions {
  readonly prisma: PrismaClient;
  readonly jwtAccessSecret: string;
  readonly accessTokenTtlSeconds: number;
  readonly passwordHashCost?: number;
}

export interface ApplicationServices {
  readonly authService: AuthService;
  readonly tokenService: TokenService;
  readonly productService: ProductService;
  readonly categoryService: CategoryService;
  readonly cartService: CartService;
}

/**
 * 組裝具體實作的唯一地方（composition root）；其他模組只依賴介面。
 */
export function createApplicationServices(options: CompositionOptions): ApplicationServices {
  const tokenService = createJwtTokenService({
    secret: options.jwtAccessSecret,
    ttlSeconds: options.accessTokenTtlSeconds,
  });
  const authService = createAuthService({
    users: createPrismaUserRepository(options.prisma),
    passwords: createBcryptPasswordHasher(options.passwordHashCost),
    tokens: tokenService,
  });
  const productService = createProductService({
    products: createPrismaProductRepository(options.prisma),
  });
  const categoryService = createCategoryService(createPrismaCategoryRepository(options.prisma));
  const cartService = createCartService(createPrismaCartRepository(options.prisma));
  return { authService, tokenService, productService, categoryService, cartService };
}
