import { NextResponse, type NextRequest } from "next/server";

// Same name as SESSION_COOKIE in lib/db.ts; not imported so the proxy bundle stays free of the DB and SDK.
const SESSION_COOKIE = "ic_session";

// shortcut: per-instance memory, resets on cold start and isn't shared across instances; move to Upstash or Vercel WAF if the demo gets abused.
const hits = new Map<string, { n: number; reset: number }>();
const LIMIT = 20;
const WINDOW_MS = 60_000;

function limited(ip: string) {
  const now = Date.now();
  if (hits.size > 10_000) hits.clear();
  const h = hits.get(ip);
  if (!h || now > h.reset) {
    hits.set(ip, { n: 1, reset: now + WINDOW_MS });
    return false;
  }
  return ++h.n > LIMIT;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Webhooks are exempt: Razorpay retries must never be throttled.
  if (req.method === "POST" && pathname.startsWith("/api/") && !pathname.startsWith("/api/webhooks/")) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
    if (limited(ip)) {
      return NextResponse.json({ error: { description: "Too many requests. Try again in a minute." } }, { status: 429 });
    }
  }

  if (req.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  // First visit: mint a session and forward it on this request too, so the route sees it immediately.
  const id = crypto.randomUUID();
  req.cookies.set(SESSION_COOKIE, id);
  const res = NextResponse.next({ request: { headers: req.headers } });
  // Not httpOnly on purpose: "Copy as cURL" reads it so copied commands replay against the same demo session.
  res.cookies.set(SESSION_COOKIE, id, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.json$).*)"],
};
