import { NextResponse, type NextRequest } from "next/server";
import { advanceOrder, getOrder, sessionOf } from "@/lib/db";
import { errorResponse, fail } from "@/lib/razorpay";

export const runtime = "nodejs";

// Deliberately broken (scenario #2): believes whatever the browser says about the payment.
export async function POST(req: NextRequest) {
  try {
    const { razorpay_order_id, razorpay_payment_id } = await req.json();
    const order = await getOrder(sessionOf(req), String(razorpay_order_id ?? ""));
    if (!order) return fail(404, "No such order in this session");

    const updated = await advanceOrder({ orderId: order.rzp_order_id, paymentId: String(razorpay_payment_id) }, "paid");
    return NextResponse.json({ status: "paid", order: updated ?? order });
  } catch (e) {
    return errorResponse(e);
  }
}
