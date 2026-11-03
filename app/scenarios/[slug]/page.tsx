import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScenarioRunner } from "@/app/components/ScenarioRunner";
import { getScenario, SCENARIOS } from "@/lib/scenarios";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => SCENARIOS.map((s) => ({ slug: s.slug }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = getScenario((await params).slug);
  return { title: s ? `#${s.n} ${s.title} · Integration Clinic` : "Integration Clinic" };
}

function Diff({ text }: { text: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-line bg-code py-2 text-xs leading-5">
      {text.split("\n").map((line, i) => (
        <span
          key={i}
          className={`block px-3 ${line.startsWith("+") ? "bg-ok-bg text-ok" : line.startsWith("-") ? "bg-bad-bg text-bad" : ""}`}
        >
          {line || " "}
        </span>
      ))}
    </pre>
  );
}

const Panel = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <section aria-labelledby={`panel-${n}`} className="min-w-0 rounded-lg border border-line bg-panel p-5">
    <h2 id={`panel-${n}`} className="text-sm font-semibold">
      <span className="text-muted">{n}.</span> {title}
    </h2>
    <div className="mt-3">{children}</div>
  </section>
);

export default async function ScenarioPage({ params }: Props) {
  const s = getScenario((await params).slug);
  if (!s) notFound();

  return (
    <div className="space-y-6">
      <header>
        <Link href="/#scenarios" className="text-sm text-muted hover:text-foreground">← All scenarios</Link>
        <p className="mt-4 text-xs font-medium text-bad">Scenario #{s.n}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{s.title}</h1>
        <p className="mt-2 text-muted">{s.symptom}</p>
      </header>

      <Panel n={1} title="What the merchant did">
        <pre className="overflow-x-auto rounded-md border border-line bg-code px-3 py-2 text-xs leading-5">{s.snippet}</pre>
        <p className="mt-2 text-xs text-muted">
          Broken: <code>{s.routes.broken}</code> · Fixed: <code>{s.routes.fixed}</code>
        </p>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Panel n={2} title="What happened">
          <ScenarioRunner slug={s.slug} />
        </Panel>
        <Panel n={3} title="Root cause and fix">
          <p className="text-sm">{s.cause}</p>
          <p className="mt-3 text-sm">
            <span className="font-medium">Fix:</span> {s.fix}
          </p>
          <div className="mt-3">
            <Diff text={s.diff} />
          </div>
          <Link href={`/docs/${s.slug}`} className="mt-4 inline-block text-sm text-accent underline">
            Read the troubleshooting doc →
          </Link>
        </Panel>
      </div>
    </div>
  );
}
