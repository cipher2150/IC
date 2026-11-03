import { NextResponse, type NextRequest } from "next/server";
import { processEvent } from "@/lib/db";
import { errorResponse, fail, verifySignature } from "@/lib/razorpay";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // Read the exact bytes Razorpay signed. Parsing first and re-serialising breaks the HMAC.
    const raw = await req.text();
    const signature = req.headers.get("x-razorpay-signature") ?? "";
    if (!verifySignature(raw, signature, process.env.RAZORPAY_WEBHOOK_SECRET ?? "")) {
      return fail(400, "Invalid webhook signature");
    }
    const eventId = req.headers.get("x-razorpay-event-id");
    if (!eventId) return fail(400, "Missing x-razorpay-event-id header");

    // Duplicates also get a 200: any 4xx/5xx makes Razorpay retry.
    return NextResponse.json(await processEvent(eventId, raw));
  } catch (e) {
    return errorResponse(e);
  }
}
