// The one POST /api/alerts call the alert forms share (PriceAlert.tsx and the
// release forms in components/releases/), so they read the answer the same way.
import type { AlertCondition, AlertSubject, AlertType } from "@/lib/alert-kinds";
import type { MarketCode } from "@/lib/markets";

export type AlertStatus = { phase: "idle" | "sending" | "offline" } | { phase: "done"; confirm: boolean } | { phase: "error"; error: string };

export type AlertBody = { email: string; slug: string; kind: AlertSubject; market: MarketCode; type: AlertType; condition?: AlertCondition; target?: number | null; elapsedMs: number; website: string };

export async function postAlert(body: AlertBody): Promise<AlertStatus> {
  try {
    const res = await fetch("/api/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, email: body.email.trim() }) });
    if (res.status === 503) return { phase: "offline" };
    const d = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; confirm?: boolean };
    if (!res.ok || !d.ok) return { phase: "error", error: d.error ?? "Something went wrong. Please try again." };
    return { phase: "done", confirm: Boolean(d.confirm) };
  } catch {
    return { phase: "error", error: "Couldn't reach the site. Check your connection and try again." };
  }
}

export const alertField =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-base text-fg placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 sm:text-sm";
