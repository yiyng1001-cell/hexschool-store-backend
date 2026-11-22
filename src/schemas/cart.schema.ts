import { z } from "zod";
import { MAX_ITEM_QUANTITY, MIN_ITEM_QUANTITY } from "../models/cart-limits.js";

export const setCartItemBodySchema = z.strictObject({
  quantity: z
    .number({ error: "必須是整數" })
    .int("必須是整數")
    .min(MIN_ITEM_QUANTITY, `不可小於 ${MIN_ITEM_QUANTITY}；若要移除請使用 DELETE`)
    .max(MAX_ITEM_QUANTITY, `不可大於 ${MAX_ITEM_QUANTITY}`),
});

export type SetCartItemBody = z.infer<typeof setCartItemBodySchema>;
