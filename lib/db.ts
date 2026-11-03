import { neon } from "@neondatabase/serverless";
import type { NextRequest } from "next/server";
import { ConfigError } from "./razorpay";

export type OrderStatus = "created" | "failed" | "paid" | "refunded";
export type Order = {
  id: string;
  session_id: string;
  sku: string;
  amount_paise: number;
  rzp_order_id: string;
  rzp_payment_id: string | null;
  status: OrderStatus;
  fulfilment_count: number;
  created_at: string;
};

export const SESSION_COOKIE = "ic_session";

export function db() {
  if (!process.env.DATABASE_URL) throw new ConfigError("DATABASE_URL is not set");
  return neon(process.env.DATABASE_URL);
}

export function sessionOf(req: NextRequest) {
  const id = req.cookies.get(SESSION_COOKIE)?.value;
  if (!id) throw new Error("Missing session cookie (proxy.ts should have set it)");
  return id;
}

// Only real Checkout orders are reusable: not payment links (plink_) or synthetic demo rows (demo_).
export async function findOpenOrder(session: string, sku: string, amountPaise: number) {
  const rows = await db()`
    SELECT * FROM orders
    WHERE session_id = ${session} AND sku = ${sku} AND amount_paise = ${amountPaise}
      AND status = 'created' AND rzp_order_id LIKE 'order%'
    ORDER BY id DESC LIMIT 1`;
  return rows[0] as Order | undefined;
}

export async function insertOrder(o: { session: string; sku: string; amountPaise: number; rzpOrderId: string }) {
  const rows = await db()`
    INSERT INTO orders (session_id, sku, amount_paise, rzp_order_id)
    VALUES (${o.session}, ${o.sku}, ${o.amountPaise}, ${o.rzpOrderId})
    RETURNING *`;
  return rows[0] as Order;
}

export async function getOrder(session: string, rzpOrderId: string) {
  const rows = await db()`SELECT * FROM orders WHERE session_id = ${session} AND rzp_order_id = ${rzpOrderId}`;
  return rows[0] as Order | undefined;
}

export async function listOrders(session: string) {
  return (await db()`SELECT * FROM orders WHERE session_id = ${session} ORDER BY id DESC LIMIT 20`) as Order[];
}

// The only place status changes. Forward-only, so /verify and the webhook can land in any order,
// and fulfilment rides on the created/failed -> paid transition, which can only happen once.
export async function advanceOrder(match: { orderId?: string; paymentId?: string }, next: OrderStatus) {
  const orderId = match.orderId ?? null;
  const paymentId = match.paymentId ?? null;
  const rows = await db()`
    UPDATE orders SET
      status = ${next}::text,
      rzp_payment_id = COALESCE(${paymentId}::text, rzp_payment_id),
      fulfilment_count = fulfilment_count + CASE WHEN ${next}::text = 'paid' THEN 1 ELSE 0 END
    WHERE (rzp_order_id = ${orderId}::text OR rzp_payment_id = ${paymentId}::text)
      AND array_position(ARRAY['created','failed','paid','refunded'], status)
        < array_position(ARRAY['created','failed','paid','refunded'], ${next}::text)
    RETURNING *`;
  return rows[0] as Order | undefined;
}

type RazorpayEvent = { event: string; payload: Record<string, { entity: Record<string, string> }> };

function applyEvent({ event, payload: p }: RazorpayEvent) {
  switch (event) {
    case "payment.captured":
      return advanceOrder({ orderId: p.payment.entity.order_id, paymentId: p.payment.entity.id }, "paid");
    case "payment.failed":
      return advanceOrder({ orderId: p.payment.entity.order_id }, "failed");
    case "payment_link.paid":
      return advanceOrder({ orderId: p.payment_link.entity.id, paymentId: p.payment.entity.id }, "paid");
    case "refund.processed":
      return advanceOrder({ paymentId: p.refund.entity.payment_id }, "refunded");
  }
}

// Dedupe on the event id, then apply. If applying fails, forget the event so Razorpay's retry gets through.
export async function processEvent(eventId: string, raw: string) {
  const event = JSON.parse(raw) as RazorpayEvent;
  const inserted = await db()`
    INSERT INTO webhook_events (event_id, type, payload) VALUES (${eventId}, ${event.event}, ${raw}::jsonb)
    ON CONFLICT (event_id) DO NOTHING RETURNING event_id`;
  if (inserted.length === 0) return { status: "duplicate" as const, event_id: eventId };
  try {
    return { status: "applied" as const, event: event.event, order: (await applyEvent(event)) ?? null };
  } catch (e) {
    await db()`DELETE FROM webhook_events WHERE event_id = ${eventId}`;
    throw e;
  }
}
