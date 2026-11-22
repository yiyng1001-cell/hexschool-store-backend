import type { RequestHandler, Response } from "express";
import { UnauthorizedError } from "../errors/http-errors.js";
import type { AccessTokenClaims, TokenService } from "../services/token.service.js";

const BEARER_PATTERN = /^Bearer (\S+)$/i;
const AUTH_LOCALS_KEY = "auth";

export function extractBearerToken(authorizationHeader: string | undefined): string | undefined {
  return BEARER_PATTERN.exec(authorizationHeader ?? "")?.[1];
}

export function createAuthenticate(tokens: Pick<TokenService, "verify">): RequestHandler {
  return (req, res, next) => {
    const token = extractBearerToken(req.headers.authorization);
    if (token === undefined) {
      next(new UnauthorizedError());
      return;
    }

    const result = tokens.verify(token);
    if (!result.ok) {
      next(new UnauthorizedError());
      return;
    }

    res.locals[AUTH_LOCALS_KEY] = result.claims;
    next();
  };
}

/**
 * 取得已通過 `authenticate` 的使用者身分；沒有則視為未登入。
 */
export function getAuthenticatedClaims(res: Response): AccessTokenClaims {
  const claims = res.locals[AUTH_LOCALS_KEY] as AccessTokenClaims | undefined;
  if (claims === undefined) {
    throw new UnauthorizedError();
  }
  return claims;
}
