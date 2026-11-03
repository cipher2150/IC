import Link from "next/link";
import { CATALOG, formatPaise, toPaise } from "@/lib/catalog";
import { SCENARIOS } from "@/lib/scenarios";
import { BuyButton } from "./components/BuyButton";
import { Orders } from "./components/Orders";

export default function Home() {
  return (
    <div className="space-y-14">
      <section className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">A demo store that breaks on purpose</h1>
        <p className="mt-3 text-muted">
          Buy something with a Razorpay test card, then pick a common integration mistake and watch it happen against the real
          test API: the request, the response, the root cause and the fix.
        </p>
        <p className="mt-2 text-sm text-muted">
          Test card: <span className="font-mono">4111 1111 1111 1111</span>, any future expiry, any CVV.
        </p>
      </section>

      <section aria-labelledby="catalog-heading">
        <h2 id="catalog-heading" className="text-lg font-semibold">Store</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-3">
          {CATALOG.map((item) => (
            <li key={item.sku} className="flex flex-col rounded-lg border border-line bg-panel p-5">
              <h3 className="font-medium">{item.name}</h3>
              <p className="mt-1 flex-1 text-sm text-muted">{item.blurb}</p>
              <p className="mt-3 text-xl font-semibold tabular-nums">{formatPaise(toPaise(item.priceRupees))}</p>
              <BuyButton sku={item.sku} />
            </li>
          ))}
        </ul>
      </section>

      <section id="scenarios" aria-labelledby="scenarios-heading" className="scroll-mt-6">
        <h2 id="scenarios-heading" className="text-lg font-semibold">Break it</h2>
        <p className="mt-1 text-sm text-muted">Each scenario runs the same action against a deliberately broken route and the correct one.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {SCENARIOS.map((s) => (
            <li key={s.slug}>
              <Link href={`/scenarios/${s.slug}`} className="block h-full rounded-lg border border-line bg-panel p-4 hover:border-muted">
                <span className="text-xs font-medium text-bad">#{s.n}</span>
                <span className="mt-1 block font-medium">{s.title}</span>
                <span className="mt-1 block text-sm text-muted">{s.symptom}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Orders />
    </div>
  );
}
