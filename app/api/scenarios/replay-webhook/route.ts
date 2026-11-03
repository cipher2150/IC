import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { insertOrder, sessionOf } from "@/lib/db";
import { ConfigError, errorResponse, sign } from "@/lib/razorpay";

export const runtime = "nodejs";

// Builds a signed payment.captured event for a fresh synthetic order, for the browser to POST (twice).
// It only ever signs for its own demo_ order, so it can't be used to mark a real order paid.
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) throw new ConfigError("RAZORPAY_WEBHOOK_SECRET is not set");

    const id = randomUUID().replaceAll("-", "").slice(0, 14);
    const orderId = `demo_order_${id}`;
    await insertOrder({ session: sessionOf(req), sku: "ebook", amountPaise: 49900, rzpOrderId: orderId });

    const event = {
      entity: "event",
      event: "payment.captured",
      contains: ["payment"],
      payload: {
        payment: {
          entity: { id: `demo_pay_${id}`, entity: "payment", amount: 49900, currency: "INR", status: "captured", order_id: orderId, method: "card" },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };
    // Pretty-printed on purpose: re-serialising it produces different bytes, which scenario #6 relies on.
    const body = JSON.stringify(event, null, 2);

    return NextResponse.json({
      order_id: orderId,
      body,
      headers: { "content-type": "application/json", "x-razorpay-event-id": `demo_evt_${id}`, "x-razorpay-signature": sign(body, secret) },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
