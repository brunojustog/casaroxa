"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CART_STORAGE_KEY,
  EMPTY_CART,
  addItem,
  cartCount,
  cartKeyOf,
  cartTotal,
  clearCart,
  removeItem,
  setQuantity,
  type Cart,
  type CartItem,
} from "@/lib/cart";

type CartContextValue = {
  cart: Cart;
  count: number;
  total: number;
  hydrated: boolean;
  add: (item: Omit<CartItem, "quantity">) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart>(EMPTY_CART);
  const [hydrated, setHydrated] = useState(false);

  // Hidrata do localStorage no primeiro render do client
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Cart;
        if (parsed && Array.isArray(parsed.items)) {
          setCart(parsed);
        }
      }
    } catch {
      // ignora — começa carrinho vazio
    } finally {
      setHydrated(true);
    }
  }, []);

  // Persiste sempre que mudar (após hidratado)
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // ignora (modo privado, etc)
    }
  }, [cart, hydrated]);

  const add = useCallback(
    (item: Omit<CartItem, "quantity">) => setCart((c) => addItem(c, item)),
    [],
  );
  const setQty = useCallback(
    (key: string, qty: number) => setCart((c) => setQuantity(c, key, qty)),
    [],
  );
  const remove = useCallback((key: string) => setCart((c) => removeItem(c, key)), []);
  const clear = useCallback(() => setCart(clearCart()), []);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      count: cartCount(cart),
      total: cartTotal(cart),
      hydrated,
      add,
      setQty,
      remove,
      clear,
    }),
    [cart, hydrated, add, setQty, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

export { cartKeyOf };
