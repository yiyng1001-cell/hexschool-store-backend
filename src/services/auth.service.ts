import {
  ConflictError,
  InvalidCredentialsError,
  UnauthorizedError,
} from "../errors/http-errors.js";
import type { UserRecord, UserRepository } from "../models/user.model.js";
import type { UserRole } from "../models/user-role.js";
import { normalizeEmail } from "./email.js";
import type { PasswordHasher } from "./password.service.js";
import type { TokenService } from "./token.service.js";

export interface RegisterInput {
  readonly email: string;
  readonly password: string;
  readonly name: string;
}

export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

export interface PublicUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: UserRole;
  readonly createdAt: Date;
}

export interface AuthSession {
  readonly user: PublicUser;
  readonly accessToken: string;
}

export interface AuthService {
  register(input: RegisterInput): Promise<AuthSession>;
  login(input: LoginInput): Promise<AuthSession>;
  getCurrentUser(userId: string): Promise<PublicUser>;
}

export interface AuthServiceDependencies {
  readonly users: UserRepository;
  readonly passwords: PasswordHasher;
  readonly tokens: Pick<TokenService, "issue">;
}

/**
 * 只挑選可對外公開的欄位；密碼雜湊絕不離開服務層。
 */
export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export function createAuthService({
  users,
  passwords,
  tokens,
}: AuthServiceDependencies): AuthService {
  const startSession = (user: UserRecord): AuthSession => ({
    user: toPublicUser(user),
    accessToken: tokens.issue({ userId: user.id, role: user.role }),
  });

  return {
    async register({ email, password, name }) {
      const passwordHash = await passwords.hash(password);
      const created = await users.create({
        email: normalizeEmail(email),
        passwordHash,
        name,
      });
      if (!created.ok) {
        throw new ConflictError("EMAIL_ALREADY_EXISTS", "此 email 已被註冊");
      }
      return startSession(created.user);
    },

    async login({ email, password }) {
      const user = await users.findByEmail(normalizeEmail(email));
      if (user === null) {
        await passwords.verifyAgainstDecoy(password);
        throw new InvalidCredentialsError();
      }
      const passwordMatches = await passwords.verify(password, user.passwordHash);
      if (!passwordMatches) {
        throw new InvalidCredentialsError();
      }
      return startSession(user);
    },

    async getCurrentUser(userId) {
      const user = await users.findById(userId);
      if (user === null) {
        throw new UnauthorizedError();
      }
      return toPublicUser(user);
    },
  };
}
