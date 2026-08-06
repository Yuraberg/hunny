import express from 'express';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const app = express();
app.use(express.json({ limit: '20kb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/order', async (req, res) => {
  const { name, phone, address, comment, items, total } = req.body ?? {};

  if (typeof name !== 'string' || !name.trim() || typeof phone !== 'string' || !phone.trim()) {
    return res.status(400).json({ ok: false, error: 'name and phone are required' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ ok: false, error: 'items must be a non-empty array' });
  }
  if (typeof total !== 'number' || !Number.isFinite(total) || total <= 0) {
    return res.status(400).json({ ok: false, error: 'total must be a positive number' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO orders (name, phone, address, comment, items, total)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        name.trim(),
        phone.trim(),
        address?.trim() || null,
        comment?.trim() || null,
        JSON.stringify(items),
        Math.round(total),
      ]
    );
    res.json({ ok: true, orderId: result.rows[0].id });
  } catch (err) {
    console.error('order insert failed', err);
    res.status(500).json({ ok: false, error: 'internal error' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`order-api listening on ${port}`));
