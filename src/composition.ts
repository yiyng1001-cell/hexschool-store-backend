import type { PrismaClient } from "./models/prisma-postgres-client.js";
import { createPrismaUserRepository } from "./models/user.model.js";
import { createAuthService, type AuthService } from "./services/auth.service.js";
import { createBcryptPasswordHasher } from "./services/password.service.js";
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
  return { authService, tokenService };
}
