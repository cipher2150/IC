import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export class ConfigError extends Error {}

// This app only ever talks to Razorpay test mode, so a live or placeholder key is a config bug.
export function assertKeys() {
  const key_id = process.env.RAZORPAY_KEY_ID ?? "";
  const key_secret = process.env.RAZORPAY_KEY_SECRET ?? "";
  if (!key_id.startsWith("rzp_test_")) {
    throw new ConfigError(`RAZORPAY_KEY_ID must be a test-mode key (rzp_test_…), got "${key_id.slice(0, 9) || "nothing"}"`);
  }
  if (!key_secret) throw new ConfigError("RAZORPAY_KEY_SECRET is not set");
  return { key_id, key_secret };
}

export const getRazorpay = () => new Razorpay(assertKeys());

export const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("hex");

export function verifySignature(payload: string, signatureHex: string, secret: string) {
  if (!secret) return false; // an unset secret must never verify anything
  const expected = Buffer.from(sign(payload, secret), "hex");
  const given = Buffer.from(signatureHex, "hex");
  // timingSafeEqual throws on unequal lengths, so compare lengths first.
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const fail = (status: number, description: string) =>
  NextResponse.json({ error: { description } }, { status });

// Razorpay SDK rejects with { statusCode, error }; pass the real API body through untouched.
export function errorResponse(e: unknown) {
  if (e && typeof e === "object" && "statusCode" in e && "error" in e) {
    return NextResponse.json({ error: e.error }, { status: Number(e.statusCode) || 502 });
  }
  if (e instanceof ConfigError) return fail(500, e.message);
  if (e instanceof SyntaxError) return fail(400, "Request body must be valid JSON");
  console.error(e);
  return fail(500, "Internal error (see server logs)");
}
