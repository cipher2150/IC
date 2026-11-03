import Razorpay from "razorpay";
import { NextResponse, type NextRequest } from "next/server";
import { assertKeys, errorResponse } from "@/lib/razorpay";

export const runtime = "nodejs";

// Deliberately broken (scenario #4): bad credentials, built inline so the guarded client in lib/razorpay.ts stays clean.
export async function POST(req: NextRequest) {
  try {
    const { variant } = await req.json();
    const { key_id } = assertKeys();
    const credentials =
      variant === "live-key"
        ? { key_id: "rzp_live_PLACEHOLDER00000", key_secret: "PLACEHOLDER_SECRET" } // copied from a tutorial
        : { key_id, key_secret: "secret_from_a_different_account" };

    const order = await new Razorpay(credentials).orders.create({ amount: 49900, currency: "INR" });
    return NextResponse.json({ unexpected: "Razorpay accepted these credentials", order_id: order.id });
  } catch (e) {
    return errorResponse(e);
  }
}
