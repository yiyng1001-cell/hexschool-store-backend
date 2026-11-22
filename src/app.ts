import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import type { AppConfig } from "./config/env.js";
import type { AppLogger } from "./config/logger.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { createHttpLogger } from "./middlewares/http-logger.js";
import { notFoundHandler } from "./middlewares/not-found.js";
import { createAuthController } from "./controllers/auth.controller.js";
import { createAuthenticate } from "./middlewares/authenticate.js";
import { createAuthRouter } from "./routes/auth.routes.js";
import { createHealthRouter } from "./routes/health.routes.js";
import type { AuthService } from "./services/auth.service.js";
import type { TokenService } from "./services/token.service.js";

export interface AppDependencies {
  readonly config: Pick<AppConfig, "corsOrigins">;
  readonly logger: AppLogger;
  readonly authService: AuthService;
  readonly tokenService: Pick<TokenService, "verify">;
}

const JSON_BODY_LIMIT = "100kb";
const TRUSTED_PROXY_HOPS = 1;

export function createApp({ config, logger, authService, tokenService }: AppDependencies): Express {
  const app = express();

  app.set("trust proxy", TRUSTED_PROXY_HOPS);
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(cors({ origin: [...config.corsOrigins] }));
  app.use(createHttpLogger(logger));
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.use(createHealthRouter());
  app.use(
    "/api/auth",
    createAuthRouter({
      controller: createAuthController(authService),
      authenticate: createAuthenticate(tokenService),
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
