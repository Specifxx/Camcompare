// Price alerts, the half both the form and the server need (lib/alerts.ts is
// the server half: the Neon table, tokens, email). Client-safe: no Node imports.

export const ALERT_CONDITIONS = ["new", "used", "any"] as const;
export type AlertCondition = (typeof ALERT_CONDITIONS)[number];
export const CONDITION_LABEL: Record<AlertCondition, string> = { new: "New", used: "Used or refurbished", any: "New or used" };

/** Alerts one email address may hold (active ones). */
export const ALERTS_PER_EMAIL = 50;
/** Emails per alert: at most one in this long. */
export const NOTIFY_GAP_MS = 24 * 3600_000;
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
