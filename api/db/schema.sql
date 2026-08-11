CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  phone text NOT NULL,
  address text,
  comment text,
  items jsonb NOT NULL,
  total integer NOT NULL,
  status text NOT NULL DEFAULT 'new'
);

-- Доставка до ПВЗ (Яндекс Доставка) и приём оплаты (ЮKassa) — добавлено
-- через ALTER, а не переписыванием CREATE TABLE, т.к. в проекте нет
-- отдельной системы миграций и schema.sql должен оставаться идемпотентным.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_type text NOT NULL DEFAULT 'address'; -- 'address' | 'pickup'
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_point_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_point_address text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_price integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cod'; -- 'online' | 'cod'
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status text;
