import { NextResponse, type NextRequest } from "next/server";
import { getOrder, sessionOf } from "@/lib/db";
import { errorResponse, fail, getRazorpay } from "@/lib/razorpay";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { rzp_order_id, amount } = await req.json();
    const order = await getOrder(sessionOf(req), String(rzp_order_id ?? ""));
    if (!order) return fail(404, "No such order in this session");
    if (order.status !== "paid" || !order.rzp_payment_id) return fail(400, `Only paid orders can be refunded (this one is "${order.status}")`);
    if (amount !== undefined && (!Number.isInteger(amount) || amount < 1 || amount > order.amount_paise)) {
      return fail(400, `Refund amount must be a whole number of paise between 1 and ${order.amount_paise} (what was captured)`);
    }

    const refund = await getRazorpay().payments.refund(order.rzp_payment_id, amount === undefined ? {} : { amount });
    // Status moves to "refunded" only when the refund.processed webhook arrives.
    return NextResponse.json({ refund, note: "Refund requested. Status flips to refunded on refund.processed." });
  } catch (e) {
    return errorResponse(e);
  }
}
