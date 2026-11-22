import { AppError, type ValidationDetail } from "./app-error.js";

export class ValidationError extends AppError {
  constructor(message = "請求欄位驗證失敗", details?: readonly ValidationDetail[]) {
    super(400, "VALIDATION_ERROR", message, details);
  }
}

export class InvalidCredentialsError extends AppError {
  constructor(message = "email 或密碼錯誤") {
    super(401, "INVALID_CREDENTIALS", message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "請先登入") {
    super(401, "UNAUTHORIZED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "權限不足") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "資源不存在") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  constructor(code: "EMAIL_ALREADY_EXISTS", message: string) {
    super(409, code, message);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = "請求內容過大") {
    super(413, "PAYLOAD_TOO_LARGE", message);
  }
}
