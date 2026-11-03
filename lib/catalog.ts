export type CatalogItem = { sku: string; name: string; priceRupees: number; blurb: string };

export const CATALOG: CatalogItem[] = [
  { sku: "ebook", name: "Debugging Payments (e-book)", priceRupees: 499, blurb: "Reading real API errors, one chapter per mistake." },
  { sku: "course", name: "Integration Walkthrough (video)", priceRupees: 999, blurb: "A recorded tour of this repo, route by route." },
  { sku: "cheatsheet", name: "Webhook Cheatsheet", priceRupees: 149, blurb: "Signatures, retries and idempotency on one page." },
];

export const getItem = (sku: unknown) => CATALOG.find((i) => i.sku === sku);

// The only place rupees become paise. Math.round absorbs float drift (0.1 + 0.2, 19.99 * 100).
export const toPaise = (rupees: number) => Math.round(rupees * 100);

export const formatPaise = (paise: number) => `₹${(paise / 100).toFixed(2)}`;
