import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Integration Clinic",
  description: "A Razorpay test-mode demo store that breaks on purpose: real API responses, root causes and fixes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="flex min-h-screen flex-col font-sans">
        <header className="border-b border-line">
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4 text-sm">
            <Link href="/" className="text-base font-semibold">Integration Clinic</Link>
            <Link href="/#scenarios" className="text-muted hover:text-foreground">Scenarios</Link>
            <Link href="/docs" className="text-muted hover:text-foreground">Docs</Link>
            <span className="ml-auto rounded bg-ok-bg px-2 py-0.5 text-xs font-medium text-ok">Test mode</span>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-muted">
            Unofficial demo, not affiliated with Razorpay. Test mode only: no real money moves.{" "}
            <a href="/integration-clinic.postman_collection.json" download className="text-accent underline">
              Download the Postman collection
            </a>
          </div>
        </footer>
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
