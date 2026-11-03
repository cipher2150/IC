import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST as webhook } from "@/app/api/webhooks/razorpay/route";
import { toPaise } from "@/lib/catalog";
import { db, insertOrder } from "@/lib/db";
import { sign, verifySignature } from "@/lib/razorpay";

describe("verifySignature", () => {
  const secret = "test_secret";
  const body = '{"event":"payment.captured"}';

  it("accepts a good signature", () => expect(verifySignature(body, sign(body, secret), secret)).toBe(true));
  it("rejects a bad signature", () => expect(verifySignature(body, sign(`${body} `, secret), secret)).toBe(false));
  it("rejects a length mismatch without throwing", () => expect(verifySignature(body, "ab", secret)).toBe(false));
  it("rejects everything when the secret is unset", () => expect(verifySignature(body, sign(body, ""), "")).toBe(false));
});

describe("toPaise", () => {
  it.each([
    [499, 49900],
    [0.1 + 0.2, 30],
    [19.99, 1999],
    [4.99, 499],
    [499.5, 49950],
  ])("%s rupees is %s paise", (rupees, paise) => expect(toPaise(rupees)).toBe(paise));
});

describe.skipIf(!process.env.DATABASE_URL)("webhook dedupe", () => {
  it("fulfils once when the same signed event is posted twice", async () => {
    const secret = "test_webhook_secret";
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
    const id = `test_${Date.now()}`;
    const orderId = `demo_order_${id}`;
    await insertOrder({ session: "vitest", sku: "ebook", amountPaise: 49900, rzpOrderId: orderId });

    const raw = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: `demo_pay_${id}`, order_id: orderId, amount: 49900 } } } });
    const post = () =>
      webhook(
        new NextRequest("http://localhost/api/webhooks/razorpay", {
          method: "POST",
          body: raw,
          headers: { "x-razorpay-signature": sign(raw, secret), "x-razorpay-event-id": `demo_evt_${id}` },
        }),
      );

    try {
      const first = await post();
      const second = await post();
      expect([first.status, second.status]).toEqual([200, 200]);
      expect((await second.json()).status).toBe("duplicate");
      const [order] = await db()`SELECT fulfilment_count FROM orders WHERE rzp_order_id = ${orderId}`;
      expect(order.fulfilment_count).toBe(1);
    } finally {
      await db()`DELETE FROM orders WHERE rzp_order_id = ${orderId}`;
      await db()`DELETE FROM webhook_events WHERE event_id = ${`demo_evt_${id}`}`;
    }
  });
});
