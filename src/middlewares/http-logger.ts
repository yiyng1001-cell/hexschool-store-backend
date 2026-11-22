import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { pinoHttp } from "pino-http";
import type { AppLogger } from "../config/logger.js";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const REQUEST_ID_HEADER = "x-request-id";
const HEALTH_CHECK_PATH = "/health";

/**
 * 只信任格式安全的外部 request id，避免日誌注入；否則自行產生。
 */
export function resolveRequestId(
  incoming: string | string[] | undefined,
  generateId: () => string = randomUUID,
): string {
  const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
  return candidate !== undefined && REQUEST_ID_PATTERN.test(candidate) ? candidate : generateId();
}

export function createHttpLogger(logger: AppLogger): RequestHandler {
  return pinoHttp({
    logger,
    genReqId: (req, res) => {
      const requestId = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
      res.setHeader("X-Request-Id", requestId);
      return requestId;
    },
    // 部署平台與外部排程會頻繁呼叫健康檢查，不記錄以免洗版。
    autoLogging: { ignore: (req) => req.url === HEALTH_CHECK_PATH },
  });
}
