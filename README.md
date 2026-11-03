# Integration Clinic

A public demo store on Razorpay **test mode** that breaks on purpose. Run a correct payment end to end, then flip a switch to run the same action with a common merchant mistake. You see the real request and response, the root cause and the fix side by side, plus a short troubleshooting doc for each mistake.

**Live:** https://ic-chi-silk.vercel.app

![60-second demo](docs/demo.gif) <!-- record and add docs/demo.gif -->

> Unofficial demo, not affiliated with Razorpay. Test mode only: no real money moves.

## Scenarios

| # | Mistake | Broken route | What you see | Fix |
|---|---|---|---|---|
| 1 | Rupees instead of paise | `/api/broken/amount` | ₹4.99 order for a ₹499 item; a real 400 for `499.5` | One `toPaise()` helper: `Math.round(rupees * 100)` |
| 2 | Skipping server-side verification | `/api/broken/confirm` | Order paid with a fake payment id | HMAC check + `payments.fetch` status and amount |
| 3 | Trusting the client for the price | `/api/broken/client-order` | ₹1 order for a ₹999 item | Client sends only `sku`; server owns the price |
| 4 | Wrong or mixed keys | `/api/broken/keys` | Real `401 Authentication failed` | Env vars + key-prefix guard |
| 5 | Non-idempotent webhook | `/api/broken/webhook` | `fulfilment_count = 2` after a replay | Dedupe on `X-Razorpay-Event-Id`, forward-only status |
| 6 | Parsing JSON before verifying | `/api/broken/webhook-parsed` | Signature mismatch with the right secret | `await req.text()`, verify, then parse |
| 7 | Refunding more than captured | `/api/broken/refund` | Real 400 from the refunds API | Validate against the captured amount first |
| 8 | Order stuck after closing the modal | (Checkout options) | "Waiting for payment…" forever | Handle `ondismiss` and `payment.failed` |

Scenarios #1, #4 and #7 hit the real test API. #2, #3, #5 and #6 are flaws in server logic, demonstrated against deliberately vulnerable `/api/broken/*` routes. For #5 and #6, the server signs a synthetic event with the webhook secret, and the browser posts it.

## Architecture

```mermaid
sequenceDiagram
  participant B as Browser
  participant S as Next.js server
  participant R as Razorpay
  participant D as Neon Postgres
  B->>S: POST /api/orders {sku}
  S->>R: orders.create(amount from catalog, in paise)
  S->>D: insert order (status=created)
  S-->>B: {order_id, amount, key_id}
  B->>R: Checkout.js
  R-->>B: {payment_id, order_id, signature}
  B->>S: POST /api/verify
  S->>S: HMAC-SHA256(order_id|payment_id, key_secret), timing-safe
  S->>R: payments.fetch: captured and amount matches?
  S->>D: created → paid (forward-only, fulfils once)
  R->>S: POST /api/webhooks/razorpay (source of truth)
  S->>S: verify X-Razorpay-Signature over the raw body
  S->>D: insert event id (unique) → apply once → 200
```

- `/verify` is fast feedback for the buyer. The webhook is the source of truth. Both go through one forward-only `advanceOrder()` in `lib/db.ts`, so they can arrive in either order and the order is still fulfilled exactly once.
- All state is scoped by an `ic_session` cookie, so visitors don't clobber each other's demos.
- `lib/scenarios.ts` drives the scenario pages. Adding a scenario costs one entry, one route and one `case` in `app/components/ScenarioRunner.tsx`.

```
app/page.tsx                      store, scenario picker, your orders
app/scenarios/[slug]/page.tsx     the three panels + Broken ⇄ Fixed runner
app/docs/*/page.mdx               troubleshooting pages and guides
app/api/{orders,verify,refunds,payment-links}/route.ts
app/api/webhooks/razorpay/route.ts
app/api/broken/*/route.ts         deliberately vulnerable routes
app/api/scenarios/replay-webhook  signs a synthetic event for #5 and #6
lib/{catalog,razorpay,db,scenarios,checkout}.ts
proxy.ts                          session cookie + per-IP rate limit
db/schema.sql                     2 tables, raw SQL, no ORM
```

## Test cards

Use these Indian test cards in Razorpay Checkout. No real money moves.

| Card network | Test card number |
|---|---|
| Visa | `4100 2800 0000 1007` |
| Mastercard | `5500 6700 0000 1002` |
| RuPay | `6527 6589 0000 1005` |
| Diners | `3608 280009 1007` |
| Amex | `3402 560004 01007` |

- **Expiry:** any future date, for example `12/28`
- **CVV:** any random CVV
- **OTP:** any random 4–10 digit number authenticates successfully

Use domestic (Indian) cards. International cards such as `4111 1111 1111 1111` are rejected with `international_transaction_not_allowed` on accounts that accept domestic cards only. To test scenario #8, close the modal, or choose the failure option on the test bank page.

## Run it locally

Requirements: Node 20.12 or newer, a Razorpay account in test mode, and a Neon Postgres database.

1. `npm install`
2. `cp .env.example .env.local` and fill in:
   - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`: Razorpay dashboard → Test Mode → API Keys.
   - `RAZORPAY_WEBHOOK_SECRET`: any string. Use the same value when you add the webhook in Razorpay.
   - `DATABASE_URL`: the Neon pooled connection string. With the Neon CLI and a linked project, `neon env pull` writes it for you.
3. Apply the schema: paste `db/schema.sql` into the Neon SQL editor. `psql "$DATABASE_URL_UNPOOLED" -f db/schema.sql` also works, but some networks block the Postgres protocol on port 5432. The app itself connects over HTTPS.
4. `npm run dev`, then open http://localhost:3000 and pay with a [test card](#test-cards).
5. Webhooks need a public URL, so Razorpay can't reach `localhost`. Locally, `/api/verify` still marks orders paid. Webhook-driven updates (refunds, Payment Links, failures) work on the deployed site.

Tests: `npm test`. The HMAC and `toPaise` groups always run. The webhook dedupe test runs when `DATABASE_URL` is set.

The Postman collection for the correct flow is at [`public/integration-clinic.postman_collection.json`](public/integration-clinic.postman_collection.json), and the site links to it in the footer.

## Deploy (Vercel)

The live site deploys from this GitHub repo. Every push to `main` redeploys.

1. Import the repo at vercel.com/new and set four env vars for **Production**: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` and `DATABASE_URL`.
2. In Razorpay (Test Mode) → Webhooks, add `https://<your-domain>/api/webhooks/razorpay` with the same secret. Subscribe to these events: `payment.captured`, `payment.failed`, `payment_link.paid` and `refund.processed`. Use the **production** domain, because Deployment Protection on preview URLs blocks Razorpay's calls.
3. Every Razorpay route sets `export const runtime = 'nodejs'`, because the SDK doesn't run on the Edge runtime.

## Known limits

- The rate limit (20 POSTs per minute per IP, webhooks exempt) is in-memory per instance. It blunts casual spam, but it isn't shared across serverless instances.
- The payload paths for `payment.captured` and `payment.failed` are checked against real deliveries. Check those for `payment_link.paid` and `refund.processed` against the first real delivery stored in `webhook_events.payload`.
