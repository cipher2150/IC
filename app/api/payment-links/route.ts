import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getItem, toPaise } from "@/lib/catalog";
import { insertOrder, sessionOf } from "@/lib/db";
import { errorResponse, fail, getRazorpay } from "@/lib/razorpay";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { sku } = await req.json();
    const item = getItem(sku);
    if (!item) return fail(400, `Unknown sku: ${String(sku)}`);

    const amount = toPaise(item.priceRupees);
    const link = await getRazorpay().paymentLink.create({
      amount,
      currency: "INR",
      description: item.name,
      reference_id: randomUUID(), // must be unique per link, max 40 chars
      customer: { name: "Demo Customer", email: "demo@example.com" },
      notify: { sms: false, email: false },
      notes: { sku: item.sku },
    });
    // The link id lives in rzp_order_id, so payment_link.paid moves this row through the same status logic.
    await insertOrder({ session: sessionOf(req), sku: item.sku, amountPaise: amount, rzpOrderId: link.id });

    return NextResponse.json({ id: link.id, short_url: link.short_url, amount });
  } catch (e) {
    return errorResponse(e);
  }
}
