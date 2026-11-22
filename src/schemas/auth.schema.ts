import { z } from "zod";
import { normalizeEmail } from "../services/email.js";

const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
// bcrypt 只看前 72 bytes，超過的部分會被靜默截斷，因此以 bytes 而非字元數限制。
export const MAX_PASSWORD_BYTES = 72;
const MAX_NAME_LENGTH = 50;

const REQUIRED_STRING_MESSAGE = "此欄位為必填，且必須是字串";

function requiredString() {
  return z.string({ error: REQUIRED_STRING_MESSAGE });
}

const emailSchema = requiredString()
  .transform(normalizeEmail)
  .pipe(
    z
      .string()
      .max(MAX_EMAIL_LENGTH, `長度不可超過 ${MAX_EMAIL_LENGTH} 字元`)
      .pipe(z.email("email 格式不正確")),
  );

const withinPasswordByteLimit = (password: string): boolean =>
  Buffer.byteLength(password, "utf8") <= MAX_PASSWORD_BYTES;

export const passwordSchema = requiredString()
  .min(MIN_PASSWORD_LENGTH, `至少 ${MIN_PASSWORD_LENGTH} 字元`)
  .refine(withinPasswordByteLimit, `長度不可超過 ${MAX_PASSWORD_BYTES} bytes`)
  .refine((password) => /[A-Za-z]/.test(password), "需包含英文字母")
  .refine((password) => /\d/.test(password), "需包含數字");

const nameSchema = requiredString()
  .trim()
  .min(1, "不可為空")
  .max(MAX_NAME_LENGTH, `長度不可超過 ${MAX_NAME_LENGTH} 字元`);

/**
 * 登入不套用註冊的密碼規則，避免洩漏規則；只擋掉會被 bcrypt 截斷的超長輸入。
 */
const loginPasswordSchema = requiredString()
  .min(1, "不可為空")
  .refine(withinPasswordByteLimit, `長度不可超過 ${MAX_PASSWORD_BYTES} bytes`);

export const registerBodySchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
});

export const loginBodySchema = z.strictObject({
  email: emailSchema,
  password: loginPasswordSchema,
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
