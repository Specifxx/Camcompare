// Price alerts, the half both the form and the server need (lib/alerts.ts is
// the server half: the Neon table, tokens, email). Client-safe: no Node imports.

export const ALERT_CONDITIONS = ["new", "used", "any"] as const;
export type AlertCondition = (typeof ALERT_CONDITIONS)[number];
export const ALERT_CONDITION_LABEL: Record<AlertCondition, string> = { new: "New", used: "Used or refurbished", any: "New or used" };

/**
 * What an alert waits for (the `alert_type` column; owner, 2026-10-21: "as
 * soon as our website scrapes this data it will message/email you"):
 *  - price:    a price drop: with a target, "only deals under $X"; without,
 *              "any price drop" (DROP_FRACTION under the last one reported);
 *  - restock:  a store's listing goes from not in stock to in stock;
 *  - preorder: a store lists it for preorder or in stock (a product, or a
 *              release on /releases that names one);
 *  - brand:    a new announcement from a maker on /releases.
 */
export const ALERT_TYPES = ["price", "restock", "preorder", "brand"] as const;
export type AlertType = (typeof ALERT_TYPES)[number];
/** What an alert is about (the `kind` column): a catalog product, a release card, or a maker. */
export const ALERT_SUBJECTS = ["camera", "lens", "release", "brand"] as const;
export type AlertSubject = (typeof ALERT_SUBJECTS)[number];

/** The product form's choices, Google Shopping style. "drop" and "under" are both price alerts (target empty or set). */
export const PRODUCT_ALERT_MODES = ["drop", "under", "restock", "preorder"] as const;
export type ProductAlertMode = (typeof PRODUCT_ALERT_MODES)[number];
export const PRODUCT_ALERT_MODE: Record<ProductAlertMode, { label: string; hint: string }> = {
  drop: { label: "Any price drop", hint: "An email when it gets cheaper than the last price we told you." },
  under: { label: "Only deals under a price", hint: "An email only when it's at or under your price." },
  restock: { label: "Back in stock", hint: "An email when a store has it in stock again." },
  preorder: { label: "Preorder opens", hint: "An email when any store takes orders: preorder or in stock." },
};
export const modeType = (m: ProductAlertMode): AlertType => (m === "drop" || m === "under" ? "price" : m);

/** Alerts one email address may hold (active ones). */
export const ALERTS_PER_EMAIL = 50;
/** Emails per alert: at most one in this long. */
export const NOTIFY_GAP_MS = 24 * 3600_000;
/** Stock and preorder alerts may email this often: a preorder that sells out in ten minutes can't wait a day. */
export const STOCK_NOTIFY_GAP_MS = 3 * 3600_000;
/** Brand alerts: at most one email in this long (each lists every new announcement since the last). */
export const BRAND_NOTIFY_GAP_MS = 2 * 3600_000;
/** Emails one address gets from one check run, whatever it watches; the rest wait for the next run. */
export const EMAILS_PER_ADDRESS_RUN = 3;
/** With no target price, an alert fires when the price falls at least this far below the last one it reported. */
export const DROP_FRACTION = 0.03;
/** The form's prefilled target: this far under today's lowest. */
export const SUGGEST_FRACTION = 0.05;
/** The form has to be open this long before Save counts (bots submit at once). */
export const ALERT_MIN_FILL_MS = 1500;

/** A target a bit under today's price, in minor units, rounded down to a whole currency unit. */
export function suggestTarget(priceMinor: number | null): number | null {
  if (!priceMinor || priceMinor <= 0) return null;
  const t = Math.floor((priceMinor * (1 - SUGGEST_FRACTION)) / 100) * 100;
  return t > 0 ? t : null;
}

/** "1899.99" or "1,899" typed in the form → minor units; empty → null; junk → NaN. */
export function parseTarget(typed: string): number | null {
  const s = typed.replace(/A\$|S\$|[\s,$£€]/gi, "");
  if (!s) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Math.round(Number(s) * 100);
}
