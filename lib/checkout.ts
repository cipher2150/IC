// Browser-only helpers shared by the store and the scenario runner.

export type CheckoutOrder = { order_id: string; amount: number; currency: string; key_id: string };
export type CheckoutSuccess = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type CheckoutFailure = { error: { description: string; reason?: string } };

declare global {
  interface Window {
    Razorpay?: new (options: object) => { open(): void; on(event: "payment.failed", cb: (r: CheckoutFailure) => void): void };
  }
}

export function openCheckout(
  order: CheckoutOrder,
  on: { success: (r: CheckoutSuccess) => void; dismiss?: () => void; failed?: (r: CheckoutFailure) => void },
) {
  if (!window.Razorpay) throw new Error("Checkout.js hasn't loaded yet. Check your network and reload.");
  const rzp = new window.Razorpay({
    key: order.key_id,
    order_id: order.order_id,
    amount: order.amount,
    currency: order.currency,
    name: "Integration Clinic",
    description: "Test mode: no real money moves",
    handler: on.success,
    ...(on.dismiss && { modal: { ondismiss: on.dismiss } }),
  });
  if (on.failed) rzp.on("payment.failed", on.failed);
  rzp.open();
}

export async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

export const errorText = (data: { error?: { description?: string } }) => data?.error?.description ?? "Something went wrong";

export const ordersChanged = () => window.dispatchEvent(new Event("orders-changed"));

// Excludes the fake ids scenario #2 posts and the synthetic demo_ payments from the webhook replays.
export const isRealPayment = (paymentId: string | null) => Boolean(paymentId?.startsWith("pay_") && !paymentId.startsWith("pay_FAKE"));
