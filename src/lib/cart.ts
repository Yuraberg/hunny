export interface CartProduct {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  id: string;
  qty: number;
}

const STORAGE_KEY = 'medSlobodaCart';

function getProducts(): Record<string, CartProduct> {
  const el = document.getElementById('products-data');
  if (!el?.textContent) return {};
  const list = JSON.parse(el.textContent) as CartProduct[];
  return Object.fromEntries(list.map((p) => [p.id, p]));
}

const PRODUCTS = getProducts();

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((i) => PRODUCTS[i.id] && i.qty > 0) : [];
  } catch {
    return [];
  }
}

let cart: CartItem[] = loadCart();

function saveCart() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch {
    /* localStorage unavailable — cart won't persist across reloads, non-fatal */
  }
}

function emitChange() {
  document.dispatchEvent(
    new CustomEvent('cart:change', { detail: { cart: [...cart], total: cartTotal(), count: cartCount() } })
  );
}

export function cartTotal(): number {
  return cart.reduce((sum, item) => sum + (PRODUCTS[item.id]?.price ?? 0) * item.qty, 0);
}

export function cartCount(): number {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

export function getCart(): CartItem[] {
  return [...cart];
}

export function getProduct(id: string): CartProduct | undefined {
  return PRODUCTS[id];
}

export function addToCart(id: string) {
  const existing = cart.find((i) => i.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id, qty: 1 });
  }
  saveCart();
  emitChange();
}

export function changeQty(id: string, delta: number) {
  const item = cart.find((i) => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter((i) => i.id !== id);
  saveCart();
  emitChange();
}

export function removeFromCart(id: string) {
  cart = cart.filter((i) => i.id !== id);
  saveCart();
  emitChange();
}

export function clearCart() {
  cart = [];
  saveCart();
  emitChange();
}

export function initCart() {
  emitChange();
}
