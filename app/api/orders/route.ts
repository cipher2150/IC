import { NextResponse, type NextRequest } from "next/server";
import { getItem, toPaise } from "@/lib/catalog";
import { findOpenOrder, insertOrder, listOrders, sessionOf } from "@/lib/db";
import { errorResponse, fail, getRazorpay } from "@/lib/razorpay";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // Only the sku is read. Any amount in the body is ignored: the server owns the price.
    const { sku } = await req.json();
    const item = getItem(sku);
    if (!item) return fail(400, `Unknown sku: ${String(sku)}`);

    const session = sessionOf(req);
    const amount = toPaise(item.priceRupees);
    const razorpay = getRazorpay();

    // A double-click or a closed modal should resume the same order, not create a second one.
    const open = await findOpenOrder(session, item.sku, amount);
    const orderId = open?.rzp_order_id ?? (await razorpay.orders.create({ amount, currency: "INR", notes: { sku: item.sku } })).id;
    if (!open) await insertOrder({ session, sku: item.sku, amountPaise: amount, rzpOrderId: orderId });

    return NextResponse.json({ order_id: orderId, amount, currency: "INR", key_id: process.env.RAZORPAY_KEY_ID, reused: Boolean(open) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({ orders: await listOrders(sessionOf(req)) });
  } catch (e) {
    return errorResponse(e);
  }
}
