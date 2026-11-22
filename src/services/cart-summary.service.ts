import type { CartLineRecord } from "../models/cart-item.model.js";

export interface CartItemView {
  readonly product: {
    readonly id: string;
    readonly name: string;
    readonly price: number;
    readonly imageUrl: string;
    readonly category: { readonly id: string; readonly name: string };
  };
  readonly quantity: number;
  readonly subtotal: number;
  readonly available: boolean;
}

export interface CartView {
  readonly items: readonly CartItemView[];
  readonly itemCount: number;
  readonly totalQuantity: number;
  readonly totalPrice: number;
}

function toItemView({ product, quantity }: CartLineRecord): CartItemView {
  return {
    product: {
      id: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      category: { id: product.category.id, name: product.category.name },
    },
    quantity,
    subtotal: product.price * quantity,
    available: product.deletedAt === null,
  };
}

/**
 * 純函式。已不可購買的項目仍會列出，但不計入 `totalQuantity` 與 `totalPrice`；
 * `itemCount` 則包含它們，因為使用者仍需要看到並移除它們。
 */
export function buildCartView(lines: readonly CartLineRecord[]): CartView {
  const items = lines.map(toItemView);
  const purchasable = items.filter((item) => item.available);
  return {
    items,
    itemCount: items.length,
    totalQuantity: purchasable.reduce((sum, item) => sum + item.quantity, 0),
    totalPrice: purchasable.reduce((sum, item) => sum + item.subtotal, 0),
  };
}
