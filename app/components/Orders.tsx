"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPaise } from "@/lib/catalog";
import { errorText, isRealPayment, ordersChanged, postJson } from "@/lib/checkout";
import type { Order } from "@/lib/db";

export function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState("");
  const [refunding, setRefunding] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/orders", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setOrders(data.orders);
        setUpdatedAt(new Date().toLocaleTimeString());
      } else setMessage(errorText(data));
    } catch {
      setMessage("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load runs in a microtask so the effect body itself doesn't set state.
    queueMicrotask(load);
    window.addEventListener("orders-changed", load);
    return () => window.removeEventListener("orders-changed", load);
  }, [load]);

  async function refund(o: Order) {
    setRefunding(o.rzp_order_id);
    const r = await postJson("/api/refunds", { rzp_order_id: o.rzp_order_id });
    setRefunding(null);
    setMessage(r.ok ? "Refund requested. The status changes to refunded when Razorpay sends refund.processed." : errorText(r.data));
    ordersChanged();
    // The webhook usually lands within seconds; check again so the buyer doesn't have to.
    if (r.ok) setTimeout(load, 5000);
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Your orders</h2>
        <div className="flex items-center gap-3">
          {updatedAt && <span className="text-xs text-muted" aria-live="polite">Updated {updatedAt}</span>}
          <button onClick={load} disabled={loading} className="rounded border border-line px-3 py-1 text-sm disabled:opacity-50">
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted">Scoped to this browser&apos;s session cookie. Other visitors can&apos;t see or change them.</p>
      {message && <p className="mt-2 text-sm" role="status">{message}</p>}
      {orders.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No orders yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2 pr-4 font-normal">Order</th>
                <th className="py-2 pr-4 font-normal">Item</th>
                <th className="py-2 pr-4 font-normal">Amount</th>
                <th className="py-2 pr-4 font-normal">Status</th>
                <th className="py-2 pr-4 font-normal">Fulfilled</th>
                <th className="py-2 font-normal"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-line">
                  <td className="py-2 pr-4 font-mono text-xs">{o.rzp_order_id}</td>
                  <td className="py-2 pr-4">{o.sku}</td>
                  <td className="py-2 pr-4 tabular-nums">{formatPaise(o.amount_paise)}</td>
                  <td className="py-2 pr-4">{o.status}</td>
                  <td className="py-2 pr-4 tabular-nums">{o.fulfilment_count}×</td>
                  <td className="py-2">
                    {o.status === "paid" && isRealPayment(o.rzp_payment_id) && (
                      <button
                        onClick={() => refund(o)}
                        disabled={refunding === o.rzp_order_id}
                        className="rounded border border-line px-2 py-1 text-xs disabled:opacity-50"
                      >
                        {refunding === o.rzp_order_id ? "Refunding…" : "Refund"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
