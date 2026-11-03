import { NextResponse, type NextRequest } from "next/server";
import { advanceOrder, getOrder, sessionOf } from "@/lib/db";
import { errorResponse, fail, getRazorpay, verifySignature } from "@/lib/razorpay";

export const runtime = "nodejs";

// Fast feedback for the buyer. The webhook is the source of truth; both may run, in either order.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const orderId = String(body.razorpay_order_id ?? "");
    const paymentId = String(body.razorpay_payment_id ?? "");
    const signature = String(body.razorpay_signature ?? "");

    const order = await getOrder(sessionOf(req), orderId);
    if (!order) return fail(404, "No such order in this session");

    if (!verifySignature(`${orderId}|${paymentId}`, signature, process.env.RAZORPAY_KEY_SECRET ?? "")) {
      return fail(400, "Signature mismatch: this payment did not come from Razorpay Checkout for this order");
    }

    const payment = await getRazorpay().payments.fetch(paymentId);
    if (payment.order_id !== orderId || Number(payment.amount) !== order.amount_paise) {
      return fail(400, "Payment does not match this order's id and amount");
    }
    if (payment.status === "authorized") {
      return NextResponse.json({ status: "pending", note: "Authorized but not captured yet; the webhook will mark it paid." }, { status: 202 });
    }
    if (payment.status !== "captured") return fail(400, `Payment status is "${payment.status}", not "captured"`);

    const updated = await advanceOrder({ orderId, paymentId }, "paid");
    return NextResponse.json({ status: "paid", order: updated ?? (await getOrder(order.session_id, orderId)), webhook_was_first: !updated });
  } catch (e) {
    return errorResponse(e);
  }
}
