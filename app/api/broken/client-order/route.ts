import { NextResponse, type NextRequest } from "next/server";
import { getItem } from "@/lib/catalog";
import { insertOrder, sessionOf } from "@/lib/db";
import { errorResponse, fail, getRazorpay } from "@/lib/razorpay";

export const runtime = "nodejs";

// Deliberately broken (scenario #3): the price comes from the request body.
export async function POST(req: NextRequest) {
  try {
    const { sku, amount } = await req.json();
    const item = getItem(sku);
    if (!item) return fail(400, `Unknown sku: ${String(sku)}`);

    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({ amount, currency: "INR", notes: { sku: item.sku } });
    await insertOrder({ session: sessionOf(req), sku: item.sku, amountPaise: Number(order.amount), rzpOrderId: order.id });

    return NextResponse.json({ order_id: order.id, amount: order.amount, currency: "INR", key_id: process.env.RAZORPAY_KEY_ID });
  } catch (e) {
    return errorResponse(e);
  }
}
