/**
 * Tipos e helpers do carrinho público (cardápio online).
 * Persiste em localStorage com versionamento para invalidar formato antigo.
 */

export const CART_STORAGE_KEY = "casaroxa.cart.v1";

export type CartItem = {
  /** id do Product ou Combo */
  id: string;
  kind: "PRODUTO" | "COMBO";
  name: string;
  price: number;
  imageUrl: string | null;
  quantity: number;
};

export type Cart = {
  items: CartItem[];
};

export const EMPTY_CART: Cart = { items: [] };

export function cartTotal(cart: Cart): number {
  return cart.items.reduce((acc, it) => acc + it.price * it.quantity, 0);
}

export function cartCount(cart: Cart): number {
  return cart.items.reduce((acc, it) => acc + it.quantity, 0);
}

export function cartKeyOf(item: Pick<CartItem, "id" | "kind">): string {
  return `${item.kind}:${item.id}`;
}

export function addItem(cart: Cart, item: Omit<CartItem, "quantity">): Cart {
  const key = cartKeyOf(item);
  const existing = cart.items.find((i) => cartKeyOf(i) === key);
  if (existing) {
    return {
      items: cart.items.map((i) =>
        cartKeyOf(i) === key ? { ...i, quantity: i.quantity + 1 } : i,
      ),
    };
  }
  return { items: [...cart.items, { ...item, quantity: 1 }] };
}

export function setQuantity(cart: Cart, key: string, quantity: number): Cart {
  if (quantity <= 0) return removeItem(cart, key);
  return {
    items: cart.items.map((i) => (cartKeyOf(i) === key ? { ...i, quantity } : i)),
  };
}

export function removeItem(cart: Cart, key: string): Cart {
  return { items: cart.items.filter((i) => cartKeyOf(i) !== key) };
}

export function clearCart(): Cart {
  return EMPTY_CART;
}
