"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPaise } from "@/lib/catalog";
import { errorText, isRealPayment, ordersChanged, postJson } from "@/lib/checkout";
import type { Order } from "@/lib/db";

export function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/orders");
    const data = await res.json();
    if (res.ok) setOrders(data.orders);
    else setMessage(errorText(data));
  }, []);

  useEffect(() => {
    // Initial load runs in a microtask so the effect body itself doesn't set state.
    queueMicrotask(load);
    window.addEventListener("orders-changed", load);
    return () => window.removeEventListener("orders-changed", load);
  }, [load]);

  async function refund(o: Order) {
    const r = await postJson("/api/refunds", { rzp_order_id: o.rzp_order_id });
    setMessage(r.ok ? "Refund requested. Refresh in a few seconds to see refund.processed land." : errorText(r.data));
    ordersChanged();
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your orders</h2>
        <button onClick={load} className="rounded border border-line px-3 py-1 text-sm">Refresh</button>
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
                      <button onClick={() => refund(o)} className="rounded border border-line px-2 py-1 text-xs">Refund</button>
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
