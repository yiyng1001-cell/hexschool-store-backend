import type { RequestHandler } from "express";
import { ForbiddenError } from "../errors/http-errors.js";
import type { UserRole } from "../models/user-role.js";
import { getAuthenticatedClaims } from "./authenticate.js";

/**
 * 必須接在 `authenticate` 之後。未登入回 401，角色不符回 403（S-4、S-6）。
 */
export function requireRole(requiredRole: UserRole): RequestHandler {
  return (_req, res, next) => {
    const { role } = getAuthenticatedClaims(res);
    if (role !== requiredRole) {
      next(new ForbiddenError());
      return;
    }
    next();
  };
}
