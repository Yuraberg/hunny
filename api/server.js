import express from 'express';
import pg from 'pg';
import { priceForItems, weightForItems, isFreeShipping, InvalidItemsError } from './lib/pricing.js';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const YOOKASSA_SHOP_ID = process.env.YOOKASSA_SHOP_ID;
const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY;
const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://medovayasloboda.ru';
const YOOKASSA_AUTH = 'Basic ' + Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64');

const app = express();
app.use(express.json({ limit: '20kb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

async function createYookassaPayment({ orderId, amount, description }) {
  const res = await fetch('https://api.yookassa.ru/v3/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: YOOKASSA_AUTH,
      'Idempotence-Key': orderId,
    },
    body: JSON.stringify({
      amount: { value: amount.toFixed(2), currency: 'RUB' },
      confirmation: { type: 'redirect', return_url: `${SITE_ORIGIN}/order/thanks` },
      capture: true,
      description,
      metadata: { orderId },
    }),
  });
  if (!res.ok) {
    throw new Error(`YooKassa create payment failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function fetchYookassaPayment(paymentId) {
  const res = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
    headers: { Authorization: YOOKASSA_AUTH },
  });
  if (!res.ok) {
    throw new Error(`YooKassa fetch payment failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

app.post('/order', async (req, res) => {
  const {
    name,
    phone,
    address,
    comment,
    items,
    deliveryType = 'address',
    deliveryPoint,
    deliveryPrice = 0,
    paymentMethod = 'cod',
  } = req.body ?? {};

  if (typeof name !== 'string' || !name.trim() || typeof phone !== 'string' || !phone.trim()) {
    return res.status(400).json({ ok: false, error: 'name and phone are required' });
  }
  if (!['address', 'pickup'].includes(deliveryType)) {
    return res.status(400).json({ ok: false, error: 'invalid deliveryType' });
  }
  if (deliveryType === 'pickup' && (!deliveryPoint?.id || !deliveryPoint?.address)) {
    return res.status(400).json({ ok: false, error: 'deliveryPoint is required for pickup' });
  }
  if (!['online', 'cod'].includes(paymentMethod)) {
    return res.status(400).json({ ok: false, error: 'invalid paymentMethod' });
  }
  // Сумму товаров всегда считаем сами по каталогу — цене и количеству с
  // клиента не доверяем, форма могла быть подделана в devtools. Скидка за
  // количество уже учтена внутри priceForItems.
  let goodsTotal;
  try {
    goodsTotal = priceForItems(items);
  } catch (err) {
    if (err instanceof InvalidItemsError) {
      return res.status(400).json({ ok: false, error: err.message });
    }
    throw err;
  }
  // При заказе от FREE_SHIPPING_THRESHOLD доставка бесплатна независимо от
  // того, что прислал клиент — цену доставки с фронтенда не доверяем так же,
  // как и цену товаров.
  const deliveryPriceInt = isFreeShipping(goodsTotal)
    ? 0
    : Number.isInteger(deliveryPrice) && deliveryPrice >= 0
      ? deliveryPrice
      : 0;
  const total = goodsTotal + deliveryPriceInt;

  let orderId;
  try {
    const status = paymentMethod === 'online' ? 'awaiting_payment' : 'new';
    const result = await pool.query(
      `INSERT INTO orders
         (name, phone, address, comment, items, total, status,
          delivery_type, delivery_point_id, delivery_point_address, delivery_price, payment_method)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        name.trim(),
        phone.trim(),
        address?.trim() || null,
        comment?.trim() || null,
        JSON.stringify(items),
        total,
        status,
        deliveryType,
        deliveryPoint?.id || null,
        deliveryPoint?.address || null,
        deliveryPriceInt,
        paymentMethod,
      ]
    );
    orderId = result.rows[0].id;
  } catch (err) {
    console.error('order insert failed', err);
    return res.status(500).json({ ok: false, error: 'internal error' });
  }

  if (paymentMethod !== 'online') {
    return res.json({ ok: true, orderId });
  }

  try {
    const payment = await createYookassaPayment({
      orderId,
      amount: total,
      description: `Заказ №${orderId} — Медовая Слобода`,
    });
    await pool.query('UPDATE orders SET payment_id = $1, payment_status = $2 WHERE id = $3', [
      payment.id,
      payment.status,
      orderId,
    ]);
    res.json({ ok: true, orderId, confirmationUrl: payment.confirmation?.confirmation_url });
  } catch (err) {
    // Заказ уже сохранён в БД со статусом awaiting_payment — его видно в
    // таблице orders даже если оплату создать не удалось, клиент в это
    // время падает в WhatsApp-фолбэк.
    console.error('yookassa payment creation failed', err);
    res.status(502).json({ ok: false, error: 'payment_provider_error', orderId });
  }
});

app.post('/payment/webhook', async (req, res) => {
  // ЮKassa не подписывает тело вебхука — верить ему нельзя, поэтому статус
  // всегда перепроверяем собственным запросом к их API, а не берём из body.
  const paymentId = req.body?.object?.id;
  if (!paymentId) {
    return res.status(400).end();
  }
  try {
    const payment = await fetchYookassaPayment(paymentId);
    const orderStatus =
      payment.status === 'succeeded' ? 'paid' : payment.status === 'canceled' ? 'canceled' : 'awaiting_payment';
    await pool.query('UPDATE orders SET payment_status = $1, status = $2 WHERE payment_id = $3', [
      payment.status,
      orderStatus,
      paymentId,
    ]);
  } catch (err) {
    console.error('payment webhook processing failed', err);
  }
  res.status(200).end();
});

app.post('/delivery/estimate', async (req, res) => {
  const { items, pointId } = req.body ?? {};
  if (!pointId || typeof pointId !== 'string') {
    return res.status(400).json({ ok: false, error: 'pointId is required' });
  }

  let weightGrams;
  try {
    weightGrams = weightForItems(items);
  } catch (err) {
    if (err instanceof InvalidItemsError) {
      return res.status(400).json({ ok: false, error: err.message });
    }
    throw err;
  }

  if (!process.env.YANDEX_DELIVERY_API_KEY) {
    return res.status(501).json({ ok: false, error: 'yandex_delivery_not_configured' });
  }

  // TODO: тарифный запрос к Яндекс Доставке. Вес (weightGrams) и точка
  // (pointId) уже посчитаны и провалидированы — не хватает только точного
  // контракта их API (endpoint/поля запроса), который нужно взять из
  // личного кабинета при подключении сервиса, см. план интеграции.
  res.status(501).json({ ok: false, error: 'yandex_delivery_not_implemented', weightGrams, pointId });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`order-api listening on ${port}`));
