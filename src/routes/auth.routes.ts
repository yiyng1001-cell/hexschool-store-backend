import { Router, type RequestHandler } from "express";
import type { AuthController } from "../controllers/auth.controller.js";
import { validateBody } from "../middlewares/validate.js";
import { loginBodySchema, registerBodySchema } from "../schemas/auth.schema.js";

export interface AuthRouterDependencies {
  readonly controller: AuthController;
  readonly authenticate: RequestHandler;
}

export function createAuthRouter({ controller, authenticate }: AuthRouterDependencies): Router {
  const router = Router();
  router.post("/register", validateBody(registerBodySchema), controller.register);
  router.post("/login", validateBody(loginBodySchema), controller.login);
  router.get("/me", authenticate, controller.getCurrentUser);
  return router;
}
