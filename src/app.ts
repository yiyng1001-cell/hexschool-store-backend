import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import type { AppConfig } from "./config/env.js";
import type { AppLogger } from "./config/logger.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { createHttpLogger } from "./middlewares/http-logger.js";
import { notFoundHandler } from "./middlewares/not-found.js";
import { createHealthRouter } from "./routes/health.routes.js";

export interface AppDependencies {
  readonly config: Pick<AppConfig, "corsOrigins">;
  readonly logger: AppLogger;
}

const JSON_BODY_LIMIT = "100kb";
const TRUSTED_PROXY_HOPS = 1;

export function createApp({ config, logger }: AppDependencies): Express {
  const app = express();

  app.set("trust proxy", TRUSTED_PROXY_HOPS);
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(cors({ origin: [...config.corsOrigins] }));
  app.use(createHttpLogger(logger));
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.use(createHealthRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
