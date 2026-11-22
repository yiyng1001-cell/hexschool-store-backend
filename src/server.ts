import type { Server } from "node:http";
import { createApp } from "./app.js";
import { ConfigError, loadConfig, type AppConfig } from "./config/env.js";
import { createLogger, type AppLogger } from "./config/logger.js";
import { createApplicationServices } from "./composition.js";
import { createPrismaPostgresClient, type PrismaClient } from "./models/prisma-postgres-client.js";

function loadConfigOrExit(): AppConfig {
  try {
    return loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(
        JSON.stringify({
          level: "fatal",
          msg: "invalid configuration",
          invalidVariables: error.invalidVariables,
        }),
      );
      process.exit(1);
    }
    throw error;
  }
}

function registerGracefulShutdown(server: Server, prisma: PrismaClient, logger: AppLogger): void {
  const shutdown = (signal: string): void => {
    logger.info({ signal }, "shutting down");
    server.close((error) => {
      void prisma.$disconnect().finally(() => {
        if (error) {
          logger.error({ err: error }, "error while closing server");
          process.exit(1);
        }
        process.exit(0);
      });
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

function registerProcessErrorHandlers(logger: AppLogger): void {
  process.on("unhandledRejection", (reason) => {
    logger.fatal({ err: reason }, "unhandled promise rejection");
    process.exit(1);
  });
  process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "uncaught exception");
    process.exit(1);
  });
}

function main(): void {
  const config = loadConfigOrExit();
  const logger = createLogger(config);
  registerProcessErrorHandlers(logger);

  const prisma = createPrismaPostgresClient(config.databaseUrl);
  const { authService, tokenService } = createApplicationServices({
    prisma,
    jwtAccessSecret: config.jwtAccessSecret,
    accessTokenTtlSeconds: config.accessTokenTtlSeconds,
  });
  const app = createApp({ config, logger, authService, tokenService });
  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, nodeEnv: config.nodeEnv }, "server listening");
  });
  registerGracefulShutdown(server, prisma, logger);
}

main();
