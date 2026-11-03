import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { errorResponse, fail, verifySignature } from "@/lib/razorpay";

export const runtime = "nodejs";

// Deliberately broken (scenario #5): applies every delivery, with no event-id dedupe and no status guard.
export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (!verifySignature(raw, req.headers.get("x-razorpay-signature") ?? "", process.env.RAZORPAY_WEBHOOK_SECRET ?? "")) {
      return fail(400, "Invalid webhook signature");
    }
    const event = JSON.parse(raw);
    if (event.event !== "payment.captured") return NextResponse.json({ status: "ignored" });

    const payment = event.payload.payment.entity;
    const [order] = await db()`
      UPDATE orders SET status = 'paid', rzp_payment_id = ${payment.id}, fulfilment_count = fulfilment_count + 1
      WHERE rzp_order_id = ${payment.order_id}
      RETURNING *`;
    return NextResponse.json({ status: "applied", order: order ?? null });
  } catch (e) {
    return errorResponse(e);
  }
}
