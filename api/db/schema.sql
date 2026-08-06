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
