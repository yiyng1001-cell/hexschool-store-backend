import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import type { AppConfig } from "./config/env.js";
import type { OpenApiDocument } from "./docs/openapi-document.js";
import type { AppLogger } from "./config/logger.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { createHttpLogger } from "./middlewares/http-logger.js";
import { notFoundHandler } from "./middlewares/not-found.js";
import { createAuthController } from "./controllers/auth.controller.js";
import { createAuthenticate } from "./middlewares/authenticate.js";
import { createAuthRouter } from "./routes/auth.routes.js";
import { createHealthRouter } from "./routes/health.routes.js";
import { createCartController } from "./controllers/cart.controller.js";
import { createCategoryController } from "./controllers/category.controller.js";
import { createProductController } from "./controllers/product.controller.js";
import { createCartRouter } from "./routes/cart.routes.js";
import { createCategoryRouter } from "./routes/category.routes.js";
import { createProductRouter } from "./routes/product.routes.js";
import type { AuthService } from "./services/auth.service.js";
import type { CartService } from "./services/cart.service.js";
import type { CategoryService } from "./services/category.service.js";
import type { ProductService } from "./services/product.service.js";
import type { TokenService } from "./services/token.service.js";

export interface AppDependencies {
  readonly config: Pick<AppConfig, "corsOrigins">;
  readonly logger: AppLogger;
  readonly authService: AuthService;
  readonly tokenService: Pick<TokenService, "verify">;
  readonly productService: ProductService;
  readonly categoryService: CategoryService;
  readonly cartService: CartService;
  readonly apiDocument: OpenApiDocument;
}

const JSON_BODY_LIMIT = "100kb";
const TRUSTED_PROXY_HOPS = 1;

function mountApiDocs(app: Express, apiDocument: OpenApiDocument): void {
  // `serve` 只提供 Swagger UI 的靜態檔案；`setup` 提供首頁。文件本身另以 JSON 提供，方便 Postman 匯入。
  app.get("/openapi.json", (_req, res) => {
    res.status(200).json(apiDocument);
  });
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(apiDocument as swaggerUi.JsonObject));
}

export function createApp({
  config,
  logger,
  authService,
  tokenService,
  productService,
  categoryService,
  cartService,
  apiDocument,
}: AppDependencies): Express {
  const app = express();

  app.set("trust proxy", TRUSTED_PROXY_HOPS);
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(cors({ origin: [...config.corsOrigins] }));
  app.use(createHttpLogger(logger));
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.use(createHealthRouter());
  mountApiDocs(app, apiDocument);
  app.use(
    "/api/auth",
    createAuthRouter({
      controller: createAuthController(authService),
      authenticate: createAuthenticate(tokenService),
    }),
  );

  app.use(
    "/api/products",
    createProductRouter({
      controller: createProductController(productService),
      authenticate: createAuthenticate(tokenService),
    }),
  );
  app.use("/api/categories", createCategoryRouter(createCategoryController(categoryService)));
  app.use(
    "/api/cart",
    createCartRouter({
      controller: createCartController(cartService),
      authenticate: createAuthenticate(tokenService),
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
