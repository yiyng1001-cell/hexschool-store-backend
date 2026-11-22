import type { RequestHandler } from "express";
import type { z } from "zod";
import type { ValidationDetail } from "../errors/app-error.js";
import { ValidationError } from "../errors/http-errors.js";

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
