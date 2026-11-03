export type Scenario = {
  slug: string; // also the doc page: /docs/<slug>
  n: number;
  title: string;
  symptom: string;
  cause: string;
  fix: string;
  routes: { broken: string; fixed: string };
  snippet: string; // what the merchant did
  diff: string; // unified-diff style: lines starting with - / + are coloured
};

export const SCENARIOS: Scenario[] = [
  {
    slug: "rupees-vs-paise",
    n: 1,
    title: "Rupees instead of paise",
    symptom: "Checkout shows ₹4.99 for a ₹499 item, or the API returns 400 for amount 499.5",
    cause: "Razorpay amounts are in the smallest currency unit. amount: 499 is 499 paise, which is ₹4.99. A fractional amount is rejected outright.",
    fix: "Convert once, in one helper: toPaise(rupees) = Math.round(rupees * 100). Never send a rupee value to the API.",
    routes: { broken: "POST /api/broken/amount", fixed: "POST /api/orders" },
    snippet: `const item = getItem(sku); // { priceRupees: 499 }
const order = await razorpay.orders.create({
  amount: item.priceRupees, // 499
  currency: "INR",
});`,
    diff: ` const order = await razorpay.orders.create({
-  amount: item.priceRupees,
+  amount: toPaise(item.priceRupees), // Math.round(499 * 100) = 49900
   currency: "INR",
 });`,
  },
  {
    slug: "skipping-server-verification",
    n: 2,
    title: "Skipping server-side verification",
    symptom: "An order is marked paid, but no matching payment exists in the Razorpay dashboard",
    cause: "The Checkout handler runs in the browser. Anyone can POST any payment_id and signature to your confirm endpoint, and if you don't check them, they're believed.",
    fix: "Recompute HMAC-SHA256(order_id|payment_id) with your key secret and compare in constant time, then fetch the payment and check its status, order and amount.",
    routes: { broken: "POST /api/broken/confirm", fixed: "POST /api/verify" },
    snippet: `const { razorpay_order_id, razorpay_payment_id } = await req.json();
await advanceOrder({ orderId: razorpay_order_id, paymentId: razorpay_payment_id }, "paid");`,
    diff: ` const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
+if (!verifySignature(\`\${razorpay_order_id}|\${razorpay_payment_id}\`, razorpay_signature, KEY_SECRET))
+  return fail(400, "Signature mismatch");
+const payment = await razorpay.payments.fetch(razorpay_payment_id);
+if (payment.status !== "captured" || payment.amount !== order.amount_paise)
+  return fail(400, "Payment does not match this order");
 await advanceOrder({ orderId: razorpay_order_id, paymentId: razorpay_payment_id }, "paid");`,
  },
  {
    slug: "trusting-the-client-for-price",
    n: 3,
    title: "Trusting the client for the price",
    symptom: "A ₹999 item sells for ₹1 after someone edits the request in DevTools",
    cause: "The order endpoint accepts amount from the request body. The browser is the attacker's machine; whatever it sends is a suggestion.",
    fix: "The client sends only the sku. The server looks up the price in its own catalog and creates the order from that.",
    routes: { broken: "POST /api/broken/client-order", fixed: "POST /api/orders" },
    snippet: `// browser
fetch("/api/broken/client-order", { method: "POST", body: JSON.stringify({ sku: "course", amount: 99900 }) });

// server
const { sku, amount } = await req.json();
await razorpay.orders.create({ amount, currency: "INR" });`,
    diff: `-const { sku, amount } = await req.json();
+const { sku } = await req.json();
+const amount = toPaise(getItem(sku).priceRupees);
 await razorpay.orders.create({ amount, currency: "INR" });`,
  },
  {
    slug: "wrong-or-mixed-keys",
    n: 4,
    title: "Wrong or mixed keys",
    symptom: "401 Authentication failed from the Razorpay API",
    cause: "The key id and secret don't belong together: a secret from another account or mode, or a placeholder rzp_live_ key left over from a tutorial.",
    fix: "Keep key id and secret in env vars only, and guard before the first call: the key prefix must match the environment (rzp_test_ here) and the secret must be set.",
    routes: { broken: "POST /api/broken/keys", fixed: "POST /api/orders" },
    snippet: `const razorpay = new Razorpay({
  key_id: "rzp_live_PLACEHOLDER00000", // copied from a tutorial
  key_secret: process.env.SECRET_FROM_ANOTHER_ACCOUNT,
});`,
    diff: `+const key_id = process.env.RAZORPAY_KEY_ID ?? "";
+const key_secret = process.env.RAZORPAY_KEY_SECRET ?? "";
+if (!key_id.startsWith("rzp_test_")) throw new ConfigError("RAZORPAY_KEY_ID must be a test-mode key");
+if (!key_secret) throw new ConfigError("RAZORPAY_KEY_SECRET is not set");
-const razorpay = new Razorpay({ key_id: "rzp_live_PLACEHOLDER00000", key_secret: process.env.SECRET_FROM_ANOTHER_ACCOUNT });
+const razorpay = new Razorpay({ key_id, key_secret });`,
  },
  {
    slug: "non-idempotent-webhook",
    n: 5,
    title: "Non-idempotent webhook",
    symptom: "One purchase, two fulfilments: fulfilment_count is 2",
    cause: "Razorpay delivers at least once. Retries, timeouts and replays mean the same event can arrive again, and a handler that applies every delivery does the work twice.",
    fix: "Insert X-Razorpay-Event-Id into a table with a unique key and skip the event if it's already there (still returning 200). Make the state change itself forward-only too.",
    routes: { broken: "POST /api/broken/webhook", fixed: "POST /api/webhooks/razorpay" },
    snippet: `if (event.event === "payment.captured") {
  await sql\`UPDATE orders SET status = 'paid', fulfilment_count = fulfilment_count + 1
            WHERE rzp_order_id = \${payment.order_id}\`;
}`,
    diff: `+const inserted = await sql\`INSERT INTO webhook_events (event_id, type, payload)
+  VALUES (\${eventId}, \${event.event}, \${raw}) ON CONFLICT (event_id) DO NOTHING RETURNING event_id\`;
+if (inserted.length === 0) return Response.json({ status: "duplicate" }); // 200, so no retry
 if (event.event === "payment.captured") {
   await sql\`UPDATE orders SET status = 'paid', fulfilment_count = fulfilment_count + 1
-            WHERE rzp_order_id = \${payment.order_id}\`;
+            WHERE rzp_order_id = \${payment.order_id} AND status IN ('created', 'failed')\`;
 }`,
  },
  {
    slug: "parse-before-verify",
    n: 6,
    title: "Parsing JSON before verifying the webhook",
    symptom: "Every webhook fails signature verification, even with the right secret",
    cause: "The signature covers the exact bytes Razorpay sent. JSON.stringify(await req.json()) produces different bytes (whitespace, key order, escaping), so the HMAC never matches.",
    fix: "Read the body once with await req.text(), verify that string, then JSON.parse it.",
    routes: { broken: "POST /api/broken/webhook-parsed", fixed: "POST /api/webhooks/razorpay" },
    snippet: `const event = await req.json();
const ok = verifySignature(JSON.stringify(event), signature, WEBHOOK_SECRET);
if (!ok) return fail(400, "Invalid webhook signature");`,
    diff: `-const event = await req.json();
-const ok = verifySignature(JSON.stringify(event), signature, WEBHOOK_SECRET);
+const raw = await req.text(); // the exact bytes Razorpay signed
+const ok = verifySignature(raw, signature, WEBHOOK_SECRET);
 if (!ok) return fail(400, "Invalid webhook signature");
+const event = JSON.parse(raw);`,
  },
  {
    slug: "over-refund",
    n: 7,
    title: "Refunding more than was captured",
    symptom: "400 from the refunds API when the refund amount exceeds the captured amount",
    cause: "The refund amount is forwarded from a form or an admin tool without being checked against the payment, so the API is the first thing to notice.",
    fix: "Check the order is paid and 1 ≤ amount ≤ captured amount (in paise) before calling the API, and show a clear message yourself.",
    routes: { broken: "POST /api/broken/refund", fixed: "POST /api/refunds" },
    snippet: `const { rzp_order_id, amount } = await req.json();
await razorpay.payments.refund(order.rzp_payment_id, { amount });`,
    diff: ` const { rzp_order_id, amount } = await req.json();
+if (order.status !== "paid") return fail(400, "Only paid orders can be refunded");
+if (!Number.isInteger(amount) || amount < 1 || amount > order.amount_paise)
+  return fail(400, \`Refund must be between 1 and \${order.amount_paise} paise\`);
 await razorpay.payments.refund(order.rzp_payment_id, { amount });`,
  },
  {
    slug: "modal-dismissed",
    n: 8,
    title: "Order stuck after the modal closes",
    symptom: "The page spins on \"Waiting for payment…\" forever after the buyer closes Checkout",
    cause: "Checkout only calls handler on success. If you don't handle modal.ondismiss and the payment.failed event, the UI never learns the buyer left, and the order stays created.",
    fix: "Handle ondismiss and payment.failed in the browser, mark the order failed from the payment.failed webhook, and let a retry reuse the open order.",
    routes: { broken: "Checkout without handlers", fixed: "Checkout with ondismiss + payment.failed" },
    snippet: `setStatus("Waiting for payment…");
new Razorpay({ key, order_id, amount, handler: verify }).open();`,
    diff: ` setStatus("Waiting for payment…");
-new Razorpay({ key, order_id, amount, handler: verify }).open();
+const rzp = new Razorpay({
+  key, order_id, amount, handler: verify,
+  modal: { ondismiss: () => setStatus("Checkout closed. Buy again to resume the same order.") },
+});
+rzp.on("payment.failed", (r) => setStatus(\`Payment failed: \${r.error.description}\`));
+rzp.open();`,
  },
];

export const getScenario = (slug: string) => SCENARIOS.find((s) => s.slug === slug);

export const GUIDES = [
  { slug: "checkout-in-10-minutes", title: "Checkout in 10 minutes" },
  { slug: "go-live-checklist", title: "Go-live checklist" },
];
