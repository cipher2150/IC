import { NextResponse, type NextRequest } from "next/server";
import { processEvent } from "@/lib/db";
import { errorResponse, fail, verifySignature } from "@/lib/razorpay";

export const runtime = "nodejs";

// Deliberately broken (scenario #6): verifies a re-serialised body instead of the bytes Razorpay signed.
export async function POST(req: NextRequest) {
  try {
    const event = await req.json();
    const reserialised = JSON.stringify(event);
    if (!verifySignature(reserialised, req.headers.get("x-razorpay-signature") ?? "", process.env.RAZORPAY_WEBHOOK_SECRET ?? "")) {
      return fail(400, "Invalid webhook signature");
    }
    const eventId = req.headers.get("x-razorpay-event-id");
    if (!eventId) return fail(400, "Missing x-razorpay-event-id header");
    return NextResponse.json(await processEvent(eventId, reserialised));
  } catch (e) {
    return errorResponse(e);
  }
}
