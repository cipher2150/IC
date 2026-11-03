CREATE TABLE IF NOT EXISTS orders (
  id               BIGSERIAL PRIMARY KEY,
  session_id       TEXT NOT NULL,
  sku              TEXT NOT NULL,
  amount_paise     INTEGER NOT NULL CHECK (amount_paise > 0),
  rzp_order_id     TEXT NOT NULL UNIQUE, -- order_… | plink_… | demo_order_…
  rzp_payment_id   TEXT,
  status           TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'failed', 'paid', 'refunded')),
  fulfilment_count INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_session_idx ON orders (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_payment_idx ON orders (rzp_payment_id);

CREATE TABLE IF NOT EXISTS webhook_events (
  event_id    TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  payload     JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
