export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "INVALID_CREDENTIALS",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "EMAIL_ALREADY_EXISTS",
  "PAYLOAD_TOO_LARGE",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ValidationDetail {
  readonly field: string;
  readonly message: string;
}

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: readonly ValidationDetail[] | undefined;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    details?: readonly ValidationDetail[],
  ) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = details === undefined ? undefined : [...details];
  }
}
