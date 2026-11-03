import Link from "next/link";
import { GUIDES, SCENARIOS } from "@/lib/scenarios";

export const metadata = { title: "Docs · Integration Clinic" };

export default function DocsIndex() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Docs</h1>
      <p className="mt-3 leading-7 text-muted">
        Two short guides, and one troubleshooting page per scenario. Every troubleshooting page follows the same playbook:
        symptom, who hits it, root cause, how to diagnose, fix, prevention, related.
      </p>
      <h2 className="mt-8 font-semibold">Guides</h2>
      <ul className="mt-2 space-y-2">
        {GUIDES.map((g) => (
          <li key={g.slug}><Link href={`/docs/${g.slug}`} className="text-accent underline">{g.title}</Link></li>
        ))}
      </ul>
      <h2 className="mt-8 font-semibold">Troubleshooting</h2>
      <ul className="mt-2 space-y-3">
        {SCENARIOS.map((s) => (
          <li key={s.slug}>
            <Link href={`/docs/${s.slug}`} className="text-accent underline">#{s.n} {s.title}</Link>
            <p className="text-sm text-muted">{s.symptom}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
