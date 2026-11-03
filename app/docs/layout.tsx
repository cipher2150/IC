import Link from "next/link";
import { GUIDES, SCENARIOS } from "@/lib/scenarios";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-10 md:grid-cols-[220px_1fr]">
      <nav aria-label="Docs" className="text-sm">
        <p className="font-medium">Guides</p>
        <ul className="mt-2 space-y-1.5">
          {GUIDES.map((g) => (
            <li key={g.slug}>
              <Link href={`/docs/${g.slug}`} className="text-muted hover:text-foreground">{g.title}</Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 font-medium">Troubleshooting</p>
        <ul className="mt-2 space-y-1.5">
          {SCENARIOS.map((s) => (
            <li key={s.slug}>
              <Link href={`/docs/${s.slug}`} className="text-muted hover:text-foreground">#{s.n} {s.title}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <article className="min-w-0 max-w-2xl">{children}</article>
    </div>
  );
}
