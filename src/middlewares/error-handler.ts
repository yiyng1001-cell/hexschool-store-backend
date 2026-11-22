import type { ErrorRequestHandler } from "express";
import { AppError, type ValidationDetail } from "../errors/app-error.js";

export interface ErrorResponseBody {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: readonly ValidationDetail[];
  };
}

export interface MappedError {
  readonly status: number;
  readonly body: ErrorResponseBody;
}

interface BodyParserErrorShape {
  readonly type: string;
  readonly status: number;
}

const INTERNAL_ERROR_MESSAGE = "伺服器發生錯誤，請稍後再試";

function isBodyParserError(error: unknown): error is BodyParserErrorShape {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as Record<string, unknown>;
  return typeof candidate["type"] === "string" && typeof candidate["status"] === "number";
}

function buildBody(
  code: string,
  message: string,
  details?: readonly ValidationDetail[],
): ErrorResponseBody {
  const error = details === undefined ? { code, message } : { code, message, details };
  return { success: false, error };
}

function mapBodyParserError(error: BodyParserErrorShape): MappedError {
  if (error.type === "entity.too.large") {
    return { status: 413, body: buildBody("PAYLOAD_TOO_LARGE", "請求內容過大") };
  }
  if (error.type === "entity.parse.failed") {
    return { status: 400, body: buildBody("VALIDATION_ERROR", "請求內容不是合法的 JSON") };
  }
  if (error.status >= 400 && error.status < 500) {
    return { status: 400, body: buildBody("VALIDATION_ERROR", "請求內容無法解析") };
  }
  return { status: 500, body: buildBody("INTERNAL_ERROR", INTERNAL_ERROR_MESSAGE) };
}

/**
 * 純函式：把任意錯誤轉成對外回應。未預期的錯誤只回固定訊息，不洩漏內部資訊（S-8）。
 */
export function mapErrorToResponse(error: unknown): MappedError {
  if (error instanceof AppError) {
    return { status: error.status, body: buildBody(error.code, error.message, error.details) };
  }
  if (isBodyParserError(error)) {
    return mapBodyParserError(error);
  }
  return { status: 500, body: buildBody("INTERNAL_ERROR", INTERNAL_ERROR_MESSAGE) };
}

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const mapped = mapErrorToResponse(error);
  if (mapped.status >= 500) {
    req.log.error({ err: error, errorCode: mapped.body.error.code }, "unhandled error");
  } else {
    req.log.info({ errorCode: mapped.body.error.code }, "request rejected");
  }
  res.status(mapped.status).json(mapped.body);
};
