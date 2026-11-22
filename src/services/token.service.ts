import jwt from "jsonwebtoken";
import { z } from "zod";
import { USER_ROLES, type UserRole } from "../models/user-role.js";

const JWT_ALGORITHM = "HS256";

export interface AccessTokenClaims {
  readonly userId: string;
  readonly role: UserRole;
}

export type VerifyTokenResult =
  | { readonly ok: true; readonly claims: AccessTokenClaims }
  | { readonly ok: false; readonly reason: "EXPIRED" | "INVALID" };

export interface TokenService {
  issue(claims: AccessTokenClaims): string;
  verify(token: string): VerifyTokenResult;
}

export interface JwtTokenServiceOptions {
  readonly secret: string;
  readonly ttlSeconds: number;
  readonly now?: () => number;
}

const payloadSchema = z.object({
  sub: z.string().min(1),
  role: z.enum(USER_ROLES),
  exp: z.number(),
});

function toEpochSeconds(epochMilliseconds: number): number {
  return Math.floor(epochMilliseconds / 1000);
}

/**
 * 耦合 `jsonwebtoken` 與 HS256。驗證時鎖定演算法，避免被改用 `none` 或其他演算法繞過。
 */
export function createJwtTokenService(options: JwtTokenServiceOptions): TokenService {
  const { secret, ttlSeconds, now = Date.now } = options;
  if (secret.length === 0) throw new Error("secret must not be empty");
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new RangeError("ttlSeconds must be a positive integer");
  }

  return {
    issue({ userId, role }) {
      const issuedAt = toEpochSeconds(now());
      return jwt.sign({ sub: userId, role, iat: issuedAt, exp: issuedAt + ttlSeconds }, secret, {
        algorithm: JWT_ALGORITHM,
      });
    },

    verify(token) {
      try {
        const decoded = jwt.verify(token, secret, {
          algorithms: [JWT_ALGORITHM],
          clockTimestamp: toEpochSeconds(now()),
        });
        const payload = payloadSchema.safeParse(decoded);
        if (!payload.success) return { ok: false, reason: "INVALID" };
        return { ok: true, claims: { userId: payload.data.sub, role: payload.data.role } };
      } catch (error) {
        if (error instanceof jwt.TokenExpiredError) return { ok: false, reason: "EXPIRED" };
        if (error instanceof jwt.JsonWebTokenError) return { ok: false, reason: "INVALID" };
        throw error;
      }
    },
  };
}
