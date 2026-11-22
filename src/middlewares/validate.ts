import type { RequestHandler, Response } from "express";
import type { z } from "zod";
import type { ValidationDetail } from "../errors/app-error.js";
import { NotFoundError, ValidationError } from "../errors/http-errors.js";

const UNKNOWN_FIELD_MESSAGE = "不允許的欄位";
const WHOLE_BODY_FIELD = "body";

function joinPath(path: readonly PropertyKey[]): string {
  return path.map(String).join(".");
}

/**
 * 純函式：把 zod 的驗證問題轉成逐欄位的說明。
 * 未定義的欄位（例如 `role`）逐一列出，不靜默忽略（S-3）。
 */
export function toValidationDetails(issues: readonly z.core.$ZodIssue[]): ValidationDetail[] {
  return issues.flatMap((issue): ValidationDetail[] => {
    if (issue.code === "unrecognized_keys") {
      return issue.keys.map((key) => ({
        field: joinPath([...issue.path, key]),
        message: UNKNOWN_FIELD_MESSAGE,
      }));
    }
    return [{ field: joinPath(issue.path) || WHOLE_BODY_FIELD, message: issue.message }];
  });
}

export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new ValidationError(undefined, toValidationDetails(result.error.issues)));
      return;
    }
    req.body = result.data;
    next();
  };
}

const VALIDATED_QUERY_KEY = "validatedQuery";
const MAX_RESOURCE_ID_LENGTH = 100;

/**
 * Express 5 的 `req.query` 是唯讀的，因此把驗證後的查詢參數放在 `res.locals`。
 */
export function validateQuery(schema: z.ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(new ValidationError(undefined, toValidationDetails(result.error.issues)));
      return;
    }
    res.locals[VALIDATED_QUERY_KEY] = result.data;
    next();
  };
}

export function getValidatedQuery<TQuery>(res: Response): TQuery {
  const query = res.locals[VALIDATED_QUERY_KEY] as TQuery | undefined;
  if (query === undefined) {
    throw new Error("validateQuery must run before reading the validated query");
  }
  return query;
}

/**
 * 空白或過長的 id 不可能存在，直接視為資源不存在，不進資料庫查詢。
 */
export function requireValidResourceId(parameterName: string): RequestHandler {
  return (req, _res, next) => {
    const value = req.params[parameterName];
    const isValid =
      typeof value === "string" && value.length > 0 && value.length <= MAX_RESOURCE_ID_LENGTH;
    next(isValid ? undefined : new NotFoundError());
  };
}
