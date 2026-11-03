import type { MDXComponents } from "mdx/types";
import Link from "next/link";

const components: MDXComponents = {
  h1: (p) => <h1 className="text-2xl font-semibold tracking-tight" {...p} />,
  h2: (p) => <h2 className="mt-10 text-lg font-semibold" {...p} />,
  h3: (p) => <h3 className="mt-6 font-semibold" {...p} />,
  p: (p) => <p className="mt-3 leading-7" {...p} />,
  ul: (p) => <ul className="mt-3 list-disc space-y-1.5 pl-6 leading-7" {...p} />,
  ol: (p) => <ol className="mt-3 list-decimal space-y-1.5 pl-6 leading-7" {...p} />,
  blockquote: (p) => <blockquote className="mt-4 border-l-2 border-line pl-4 text-muted" {...p} />,
  code: (p) => <code className="rounded bg-code px-1 py-0.5 font-mono text-[0.85em]" {...p} />,
  pre: (p) => (
    <pre className="mt-4 overflow-x-auto rounded-md border border-line bg-code px-4 py-3 text-xs leading-5 [&_code]:bg-transparent [&_code]:p-0" {...p} />
  ),
  a: ({ href = "", ...p }) =>
    href.startsWith("/") ? <Link href={href} className="text-accent underline" {...p} /> : <a href={href} className="text-accent underline" {...p} />,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
