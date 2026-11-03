"use client";

import { useState } from "react";
import { formatPaise } from "@/lib/catalog";
import { isRealPayment, openCheckout, type CheckoutOrder } from "@/lib/checkout";
import type { Order } from "@/lib/db";

type Mode = "broken" | "fixed";
type Entry = { method: string; url: string; status: number; headers: Record<string, string>; body?: string; response: unknown };

const JSON_HEADERS = { "content-type": "application/json" };
const shq = (s: string) => `'${s.replaceAll("'", `'\\''`)}'`;

function toCurl(e: Entry) {
  const session = document.cookie.match(/(?:^|; )ic_session=([^;]+)/)?.[1];
  const lines = [`curl -X ${e.method} ${shq(location.origin + e.url)}`];
  if (session) lines.push(`-b ${shq(`ic_session=${session}`)}`);
  for (const [k, v] of Object.entries(e.headers)) lines.push(`-H ${shq(`${k}: ${v}`)}`);
  if (e.body !== undefined) lines.push(`--data-raw ${shq(e.body)}`);
  return lines.join(" \\\n  ");
}

const pretty = (body: string) => {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
};

export function ScenarioRunner({ slug }: { slug: string }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [log, setLog] = useState<Entry[]>([]);
  const [note, setNote] = useState("");
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [amount, setAmount] = useState("100"); // scenario #3: what the tampered request sends, in paise

  async function send(method: "GET" | "POST", url: string, body?: unknown, headers: Record<string, string> = JSON_HEADERS) {
    const raw = body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body);
    const sent = raw === undefined ? {} : headers;
    const res = await fetch(url, { method, headers: sent, body: raw });
    const response = await res.json().catch(() => null);
    setLog((l) => [...l, { method, url, status: res.status, headers: sent, body: raw, response }]);
    return { ok: res.ok, data: response };
  }

  // withHandlers=false reproduces scenario #8: no ondismiss, no payment.failed listener.
  function checkout(order: CheckoutOrder, withHandlers: boolean) {
    openCheckout(order, {
      success: async (r) => {
        const v = await send("POST", "/api/verify", r);
        setNote(v.ok ? `Paid ${formatPaise(order.amount)} and verified on the server.` : "Verification failed; see the log.");
      },
      ...(withHandlers && {
        dismiss: () => {
          setNote("Checkout closed. The UI reset itself and the order is still open, so running again resumes it.");
          send("GET", "/api/orders");
        },
        failed: (f) => setNote(`Payment failed: ${f.error.description}. The payment.failed webhook marks the order failed.`),
      }),
    });
  }

  async function run(m: Mode) {
    const broken = m === "broken";
    setMode(m);
    setLog([]);
    setNote("");
    setCopied(null);
    setRunning(true);
    try {
      switch (slug) {
        case "rupees-vs-paise": {
          if (broken) await send("POST", "/api/broken/amount", { sku: "ebook", fraction: true });
          const r = await send("POST", broken ? "/api/broken/amount" : "/api/orders", { sku: "ebook" });
          if (r.ok) {
            setNote(`Order created for ${formatPaise(r.data.amount)} (catalog price ₹499.00). Checkout opens with that amount.`);
            checkout(r.data, true);
          }
          break;
        }
        case "skipping-server-verification": {
          const o = await send("POST", "/api/orders", { sku: "ebook" });
          if (!o.ok) break;
          const fake = { razorpay_order_id: o.data.order_id, razorpay_payment_id: `pay_FAKE${o.data.order_id.slice(-8)}`, razorpay_signature: "deadbeef".repeat(8) };
          const r = await send("POST", broken ? "/api/broken/confirm" : "/api/verify", fake);
          if (broken && r.ok) setNote("Order marked paid and fulfilled. No money moved: that payment id doesn't exist.");
          if (!broken) setNote("Rejected: the HMAC doesn't match, so the fake never reaches the database.");
          break;
        }
        case "trusting-the-client-for-price": {
          const r = await send("POST", broken ? "/api/broken/client-order" : "/api/orders", { sku: "course", amount: Number(amount) });
          if (r.ok) {
            setNote(`Order created for ${formatPaise(r.data.amount)} (catalog price ₹999.00).`);
            checkout(r.data, true);
          }
          break;
        }
        case "wrong-or-mixed-keys": {
          if (broken) {
            await send("POST", "/api/broken/keys", { variant: "wrong-secret" });
            await send("POST", "/api/broken/keys", { variant: "live-key" });
            setNote("Both requests reached Razorpay. The responses are the real API's.");
          } else {
            const r = await send("POST", "/api/orders", { sku: "ebook" });
            if (r.ok) setNote("Keys passed the guard and the order was created.");
          }
          break;
        }
        case "non-idempotent-webhook":
        case "parse-before-verify": {
          const ev = await send("POST", "/api/scenarios/replay-webhook", {});
          if (!ev.ok) break;
          const twice = slug === "non-idempotent-webhook";
          const target = broken ? (twice ? "/api/broken/webhook" : "/api/broken/webhook-parsed") : "/api/webhooks/razorpay";
          await send("POST", target, ev.data.body, ev.data.headers);
          if (twice) await send("POST", target, ev.data.body, ev.data.headers);
          const list = await send("GET", "/api/orders");
          const order = (list.data?.orders as Order[] | undefined)?.find((o) => o.rzp_order_id === ev.data.order_id);
          if (order) setNote(`${order.rzp_order_id}: status ${order.status}, fulfilment_count = ${order.fulfilment_count}`);
          break;
        }
        case "over-refund": {
          const list = await send("GET", "/api/orders");
          const paid = (list.data?.orders as Order[] | undefined)?.find((o) => o.status === "paid" && isRealPayment(o.rzp_payment_id));
          if (!paid) {
            setNote("This one needs a real paid test order. Buy something on the store page, then run it again.");
            break;
          }
          await send("POST", broken ? "/api/broken/refund" : "/api/refunds", { rzp_order_id: paid.rzp_order_id, amount: paid.amount_paise + 100 });
          break;
        }
        case "modal-dismissed": {
          const r = await send("POST", "/api/orders", { sku: "cheatsheet" });
          if (!r.ok) break;
          setNote(broken ? "Waiting for payment…" : "Waiting for payment… (close the modal, or pick the failure option on the test bank page)");
          checkout(r.data, !broken);
          break;
        }
      }
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function copy(i: number) {
    await navigator.clipboard.writeText(toCurl(log[i]));
    setCopied(i);
  }

  const toggle = (m: Mode, label: string) => (
    <button
      onClick={() => run(m)}
      disabled={running}
      aria-pressed={mode === m}
      className={`rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
        mode === m ? (m === "broken" ? "bg-bad text-background" : "bg-ok text-background") : "text-muted"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Run against" className="inline-flex gap-1 rounded-md border border-line p-1">
          {toggle("broken", "Broken")}
          {toggle("fixed", "Fixed")}
        </div>
        {slug === "trusting-the-client-for-price" && (
          <label className="flex items-center gap-2 text-sm text-muted">
            Tampered amount (paise)
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="numeric"
              className="w-24 rounded border border-line bg-panel px-2 py-1 font-mono text-foreground"
            />
          </label>
        )}
        {running && <span className="text-sm text-muted">Running…</span>}
      </div>

      {note && <p role="status" className="mt-3 rounded border border-line bg-code px-3 py-2 text-sm">{note}</p>}
      {log.length === 0 && !running && (
        <p className="mt-4 text-sm text-muted">Pick Broken or Fixed. Switching reruns the same action against the other route.</p>
      )}

      <ol className="mt-4 space-y-3">
        {log.map((e, i) => (
          <li key={i} className="overflow-hidden rounded-md border border-line bg-panel">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
              <code className="min-w-0 flex-1 break-all text-xs">
                <span className="font-semibold">{e.method}</span> {e.url}
              </code>
              <span className={`rounded px-1.5 py-0.5 font-mono text-xs ${e.status < 300 ? "bg-ok-bg text-ok" : "bg-bad-bg text-bad"}`}>{e.status}</span>
              <button onClick={() => copy(i)} className="rounded border border-line px-2 py-0.5 text-xs">
                {copied === i ? "Copied" : "Copy as cURL"}
              </button>
            </div>
            {e.body !== undefined && (
              <details className="border-b border-line">
                <summary className="cursor-pointer px-3 py-1.5 text-xs text-muted">Request body</summary>
                <pre className="max-h-64 overflow-auto bg-code px-3 py-2 text-xs">{pretty(e.body)}</pre>
              </details>
            )}
            <pre className="max-h-80 overflow-auto px-3 py-2 text-xs">{JSON.stringify(e.response, null, 2)}</pre>
          </li>
        ))}
      </ol>
    </div>
  );
}
