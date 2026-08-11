import products from '../products.generated.json' with { type: 'json' };

const BY_ID = new Map(products.map((p) => [p.id, p]));

export class InvalidItemsError extends Error {}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new InvalidItemsError('items must be a non-empty array');
  }
  return items.map((item) => {
    const product = BY_ID.get(item?.id);
    const qty = Number(item?.qty);
    if (!product || !Number.isInteger(qty) || qty <= 0) {
      throw new InvalidItemsError(`unknown product or bad qty: ${JSON.stringify(item)}`);
    }
    return { product, qty };
  });
}

// Прогрессивная скидка за количество одной позиции: скидка растёт с каждой
// добавленной банкой (индекс массива = qty), а с 10 штук за каждый полный
// десяток к заказу добавляется бесплатная банка (freeUnits). Та же шкала
// продублирована во фронтенде (src/lib/cart.ts) — это отдельный деплой
// (api/), общий модуль сюда не тянется, поэтому при изменении шкалы менять
// оба файла синхронно.
const LINE_DISCOUNT_PERCENT = [0, 0, 3, 5, 7, 8, 9, 10, 11, 12];
export const FREE_SHIPPING_THRESHOLD = 10000;

function discountPercentForQty(qty) {
  const idx = Math.min(qty, LINE_DISCOUNT_PERCENT.length - 1);
  return LINE_DISCOUNT_PERCENT[idx];
}

function freeUnitsForQty(qty) {
  return Math.floor(qty / 10);
}

export function lineForItem(product, qty) {
  const percent = discountPercentForQty(qty);
  const price = Math.round(product.price * qty * (1 - percent / 100));
  return { price, percent, freeUnits: freeUnitsForQty(qty) };
}

// Сумма товаров считается по каталогу на сервере — цене и количеству
// с клиента не доверяем (форма могла быть подделана в devtools).
export function priceForItems(items) {
  return normalizeItems(items).reduce((sum, { product, qty }) => sum + lineForItem(product, qty).price, 0);
}

export function weightForItems(items) {
  return normalizeItems(items).reduce(
    (sum, { product, qty }) => sum + product.weightGrams * (qty + freeUnitsForQty(qty)),
    0
  );
}

export function isFreeShipping(goodsTotal) {
  return goodsTotal >= FREE_SHIPPING_THRESHOLD;
}
