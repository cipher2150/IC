import { NextResponse, type NextRequest } from "next/server";
import { getOrder, sessionOf } from "@/lib/db";
import { errorResponse, fail, getRazorpay } from "@/lib/razorpay";

export const runtime = "nodejs";

// Deliberately broken (scenario #7): forwards the requested refund amount without checking what was captured.
export async function POST(req: NextRequest) {
  try {
    const { rzp_order_id, amount } = await req.json();
    const order = await getOrder(sessionOf(req), String(rzp_order_id ?? ""));
    if (!order?.rzp_payment_id) return fail(404, "No paid order with that id in this session");

    const refund = await getRazorpay().payments.refund(order.rzp_payment_id, { amount });
    return NextResponse.json({ refund });
  } catch (e) {
    return errorResponse(e);
  }
}
