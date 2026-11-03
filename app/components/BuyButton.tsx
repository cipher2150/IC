"use client";

import { useState } from "react";
import { errorText, openCheckout, ordersChanged, postJson } from "@/lib/checkout";

export function BuyButton({ sku }: { sku: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");

  function done(text: string) {
    setMessage(text);
    setBusy(false);
    ordersChanged();
  }

  async function buy() {
    setBusy(true);
    setMessage("");
    const order = await postJson("/api/orders", { sku });
    if (!order.ok) return done(errorText(order.data));
    try {
      openCheckout(order.data, {
        success: async (r) => {
          const v = await postJson("/api/verify", r);
          done(v.ok ? `Payment ${v.data.status}. Order ${r.razorpay_order_id}.` : errorText(v.data));
        },
        dismiss: () => done("Checkout closed. Your order is kept open; Buy again to resume it."),
        failed: (r) => setMessage(`Payment failed: ${r.error.description}. You can retry in the same window.`),
      });
    } catch (e) {
      done((e as Error).message);
    }
  }

  async function payByLink() {
    setBusy(true);
    setMessage("");
    const r = await postJson("/api/payment-links", { sku });
    if (r.ok) setLink(r.data.short_url);
    done(r.ok ? "Payment Link created. Pay it in another tab; the webhook marks the order paid." : errorText(r.data));
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="flex gap-2">
        <button onClick={buy} disabled={busy} className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
          {busy ? "Working…" : "Buy"}
        </button>
        <button onClick={payByLink} disabled={busy} className="rounded border border-line px-4 py-2 text-sm disabled:opacity-50">
          Pay via link
        </button>
      </div>
      {link && (
        <a href={link} target="_blank" rel="noreferrer" className="block break-all text-sm text-accent underline">
          {link}
        </a>
      )}
      {message && <p className="text-sm text-muted" role="status">{message}</p>}
    </div>
  );
}
