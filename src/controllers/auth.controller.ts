import type { RequestHandler } from "express";
import type { LoginBody, RegisterBody } from "../schemas/auth.schema.js";
import type { AuthService } from "../services/auth.service.js";
import { getAuthenticatedClaims } from "../middlewares/authenticate.js";

export interface AuthController {
  readonly register: RequestHandler<unknown, unknown, RegisterBody>;
  readonly login: RequestHandler<unknown, unknown, LoginBody>;
  readonly getCurrentUser: RequestHandler;
}

export function createAuthController(authService: AuthService): AuthController {
  return {
    async register(req, res) {
      const session = await authService.register(req.body);
      res.status(201).json({ success: true, data: session });
    },

    async login(req, res) {
      const session = await authService.login(req.body);
      res.status(200).json({ success: true, data: session });
    },

    async getCurrentUser(_req, res) {
      const { userId } = getAuthenticatedClaims(res);
      const user = await authService.getCurrentUser(userId);
      res.status(200).json({ success: true, data: { user } });
    },
  };
}
