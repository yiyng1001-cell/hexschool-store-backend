import { z } from "zod";
import { PRODUCT_SORTS } from "../models/product.model.js";
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE,
  MAX_PAGE_LIMIT,
} from "../services/pagination.js";

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 2000;
const MIN_PRICE = 1;
const MAX_PRICE = 1_000_000;
const MAX_IMAGE_URL_LENGTH = 2048;
const MAX_KEYWORD_LENGTH = 50;
const MAX_IDENTIFIER_LENGTH = 100;

const DIGITS_ONLY = /^\d+$/;

function queryInteger(label: string, min: number, max: number, fallback: number) {
  return z
    .string({ error: `${label} 必須是整數` })
    .regex(DIGITS_ONLY, `${label} 必須是整數`)
    .transform(Number)
    .pipe(
      z.number().int().min(min, `${label} 不可小於 ${min}`).max(max, `${label} 不可大於 ${max}`),
    )
    .default(fallback);
}

export const productListQuerySchema = z.strictObject({
  page: queryInteger("page", 1, MAX_PAGE, DEFAULT_PAGE),
  limit: queryInteger("limit", 1, MAX_PAGE_LIMIT, DEFAULT_PAGE_LIMIT),
  category: z
    .string({ error: "category 必須是字串" })
    .min(1, "category 不可為空")
    .max(MAX_IDENTIFIER_LENGTH, `category 長度不可超過 ${MAX_IDENTIFIER_LENGTH}`)
    .optional(),
  q: z
    .string({ error: "q 必須是字串" })
    .trim()
    .min(1, "q 不可為空；沒有關鍵字時請省略此參數")
    .max(MAX_KEYWORD_LENGTH, `q 長度不可超過 ${MAX_KEYWORD_LENGTH}`)
    .optional(),
  sort: z
    .enum(PRODUCT_SORTS, { error: `sort 必須是 ${PRODUCT_SORTS.join("、")} 其中之一` })
    .default("newest"),
});

const REQUIRED_MESSAGE = "此欄位為必填";

const nameSchema = z
  .string({ error: REQUIRED_MESSAGE })
  .trim()
  .min(1, "不可為空")
  .max(MAX_NAME_LENGTH, `長度不可超過 ${MAX_NAME_LENGTH} 字元`);

const descriptionSchema = z
  .string({ error: REQUIRED_MESSAGE })
  .trim()
  .min(1, "不可為空")
  .max(MAX_DESCRIPTION_LENGTH, `長度不可超過 ${MAX_DESCRIPTION_LENGTH} 字元`);

const priceSchema = z
  .number({ error: "必須是整數（新台幣元）" })
  .int("必須是整數（新台幣元）")
  .min(MIN_PRICE, `不可小於 ${MIN_PRICE}`)
  .max(MAX_PRICE, `不可大於 ${MAX_PRICE}`);

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}

const imageUrlSchema = z
  .string({ error: REQUIRED_MESSAGE })
  .trim()
  .max(MAX_IMAGE_URL_LENGTH, `長度不可超過 ${MAX_IMAGE_URL_LENGTH} 字元`)
  .refine(isHttpsUrl, "必須是 https:// 開頭的合法網址");

const categoryIdSchema = z
  .string({ error: REQUIRED_MESSAGE })
  .min(1, "不可為空")
  .max(MAX_IDENTIFIER_LENGTH, `長度不可超過 ${MAX_IDENTIFIER_LENGTH} 字元`);

const productShape = {
  name: nameSchema,
  description: descriptionSchema,
  price: priceSchema,
  imageUrl: imageUrlSchema,
  categoryId: categoryIdSchema,
};

export const createProductBodySchema = z.strictObject(productShape);

export const updateProductBodySchema = z
  .strictObject(productShape)
  .partial()
  .refine((fields) => Object.keys(fields).length > 0, "至少需提供一個要修改的欄位");

export type ProductListQueryInput = z.infer<typeof productListQuerySchema>;
export type CreateProductBody = z.infer<typeof createProductBodySchema>;
export type UpdateProductBody = z.infer<typeof updateProductBodySchema>;
