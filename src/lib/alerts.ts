// Price, stock, preorder and brand alerts by email, without accounts (owner, 2026-10-17: "Tracking price
// option for every single camera", "Price notification for accounts"). An
// email address plus a random token per alert is the account: the confirm,
// unsubscribe and manage links carry the token, nothing else identifies anyone.
//
// Private, like feedback (lib/feedback.ts): one table, price_alerts, in the
// same small Neon project (DATABASE_URL), created on first use. Written by
// POST /api/alerts and the token links; read by scripts/check-alerts.ts after
// each price import (a few rows every three hours), by scripts/check-watched.ts
// when WATCH_CHECKS is on (stock and preorder alerts only), and by /alerts/manage.
// Alert types (alert_type, lib/alert-kinds.ts): price, restock, preorder,
// brand. Columns added after v1 are added in place (ALTER … IF NOT EXISTS), so
// old rows read as price alerts.
// Nothing public reads it, and no page reads it at build time.
// Server-only (node:crypto, the Neon driver); the form's half is lib/alert-kinds.ts.
import { randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { CONTACT_EMAIL } from "./site";
import { ALERT_CONDITIONS, ALERT_MIN_FILL_MS, ALERT_SUBJECTS, ALERT_TYPES, ALERTS_PER_EMAIL, BRAND_NOTIFY_GAP_MS, DROP_FRACTION, NOTIFY_GAP_MS, STOCK_NOTIFY_GAP_MS, type AlertCondition, type AlertSubject, type AlertType } from "./alert-kinds";
import { EMAIL_MAX } from "./feedback-kinds";
import { createRateLimiter } from "./feedback";
import { price } from "./format";
import { MARKET_CODES, MARKETS, marketPath, type MarketCode } from "./markets";
import { lowest, type Offer } from "./offers";
import type { Release } from "./releases/core";
import { canOrder, ORDER_STATE_LABEL, ORDER_STATES, orderState, type OrderState, type StoreRow } from "./releases/stock";
import { abs } from "./site";

export const ALERTS_NOT_CONNECTED = "Price alerts aren't connected yet. Please check back soon.";
/** Unconfirmed alerts one address may have waiting: stops the form being used to mail-bomb someone. */
export const PENDING_PER_EMAIL = 5;
/** The largest target accepted (minor units): far above any camera. */
export const TARGET_MAX = 100_000_000;

// ---------------------------------------------------------------- validation

const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\u0000/g, "").trim() : v);

export const alertInput = z.object({
  email: z.preprocess((v) => (typeof clean(v) === "string" ? (clean(v) as string).toLowerCase() : v), z.string().max(EMAIL_MAX).email("That email doesn't look right.")),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,119}$/),
  kind: z.enum(ALERT_SUBJECTS),
  market: z.enum(MARKET_CODES),
  condition: z.enum(ALERT_CONDITIONS).default("any"),
  type: z.enum(ALERT_TYPES).default("price"),
  /** Minor units; null or missing means "tell me about any drop". */
  target: z.number().int().positive().max(TARGET_MAX, "That target price is too high.").nullable().optional(),
  elapsedMs: z.number().int().nonnegative().optional(),
  website: z.string().max(300).optional(),
});

export type AlertRequest = { email: string; slug: string; kind: AlertSubject; market: MarketCode; condition: AlertCondition; type: AlertType; target: number | null };

/** Which subject takes which alert: a product any but brand; a release only "preorder"; a maker only "brand". */
export const typeFits = (kind: AlertSubject, type: AlertType) => (kind === "brand" ? type === "brand" : kind === "release" ? type === "preorder" : type !== "brand");

export type AlertVerdict = { action: "create"; alert: AlertRequest } | { action: "drop" } | { action: "reject"; status: number; error: string };

/** What to do with one form submission. Pure, so tests need no database. */
export function checkAlertRequest(body: unknown): AlertVerdict {
  const parsed = alertInput.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    return { action: "reject", status: 400, error: field === "email" || field === "target" ? issue.message : "Something in the form isn't right. Please check it and try again." };
  }
  const d = parsed.data;
  if (d.website) return { action: "drop" };
  if (d.elapsedMs === undefined || d.elapsedMs < ALERT_MIN_FILL_MS) return { action: "reject", status: 422, error: "That was quick! Please wait a moment and try again." };
  if (!typeFits(d.kind, d.type)) return { action: "reject", status: 400, error: "Something in the form isn't right. Please check it and try again." };
  // A target only means something to a price alert; preorders and releases are for new stock.
  const condition = d.type === "preorder" || d.type === "brand" ? "new" : d.condition;
  return { action: "create", alert: { email: d.email, slug: d.slug, kind: d.kind, market: d.market, condition, type: d.type, target: d.type === "price" ? d.target ?? null : null } };
}

/** Ten alert requests per IP per ten minutes. */
export const alertsLimiter = createRateLimiter({ limit: 10, windowMs: 10 * 60_000 });

/** A token as the links carry it: 32 random bytes, base64url (43 characters). */
export const newToken = () => randomBytes(32).toString("base64url");
export const isToken = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{43}$/.test(t);

// ---------------------------------------------------------------- notify decision

export type AlertState = { target: number | null; lastNotifiedPrice: number | null; lastNotifiedAt: string | Date | null };

export type NotifyDecision =
  | { action: "notify"; reason: "target" | "drop" }
  | { action: "baseline"; price: number } // no target and nothing to compare with yet: remember today's price, send nothing
  | { action: "rearm" } // back above the target: forget the last price so the next dip under it is news again
  | { action: "none" };

/**
 * Whether today's lowest price (minor units, null when nobody has it) is
 * worth an email. Pure: tests/alerts.test.ts holds it.
 *  - With a target: when the price is at or under it, and lower than the
 *    price last reported (never the same price twice).
 *  - Without: when it is at least DROP_FRACTION under the last price
 *    reported, or the price seen when the alert was made.
 *  - Never more than one email per alert in NOTIFY_GAP_MS.
 */
export function decideNotify(a: AlertState, price: number | null, now = Date.now()): NotifyDecision {
  if (price === null || !(price > 0)) return { action: "none" };
  const last = a.lastNotifiedPrice;
  if (a.target !== null) {
    if (price > a.target) return last !== null && a.lastNotifiedAt ? { action: "rearm" } : { action: "none" };
  } else if (last === null) {
    return { action: "baseline", price };
  }
  if (last !== null && price >= last) return { action: "none" };
  if (a.target === null && last !== null && price > last * (1 - DROP_FRACTION)) return { action: "none" };
  const at = a.lastNotifiedAt ? new Date(a.lastNotifiedAt).getTime() : NaN;
  if (Number.isFinite(at) && now - at < NOTIFY_GAP_MS) return { action: "none" };
  return { action: "notify", reason: a.target !== null ? "target" : "drop" };
}

export type StockState = { type: AlertType; lastState: string | null; lastNotifiedAt: string | Date | null };

export type StateDecision =
  | { action: "notify"; state: OrderState }
  | { action: "baseline"; state: OrderState } // first look: remember the state, send nothing
  | { action: "state"; state: OrderState } // changed, but not into news (sold out again: re-armed)
  | { action: "none" };

const asState = (s: string | null): OrderState | null => ((ORDER_STATES as readonly string[]).includes(s ?? "") ? (s as OrderState) : null);

/**
 * A restock or preorder alert against the market's state now
 * (lib/releases/stock.ts orderState). It fires on a transition, never on a
 * state that has merely continued, so one restock is one email:
 *  - restock:  anything else → in stock;
 *  - preorder: not orderable → preorder or in stock.
 * Inside STOCK_NOTIFY_GAP_MS of the last email the stored state is left as it
 * was, so a transition the gap held back still fires on the next run. Pure.
 */
export function decideStock(a: StockState, now: OrderState, at = Date.now()): StateDecision {
  const prev = asState(a.lastState);
  if (prev === null) return { action: "baseline", state: now };
  if (prev === now) return { action: "none" };
  const news = a.type === "restock" ? now === "in_stock" && prev !== "in_stock" : canOrder(now) && !canOrder(prev);
  if (!news) return { action: "state", state: now };
  const last = a.lastNotifiedAt ? new Date(a.lastNotifiedAt).getTime() : NaN;
  if (Number.isFinite(last) && at - last < STOCK_NOTIFY_GAP_MS) return { action: "none" };
  return { action: "notify", state: now };
}

export type BrandDecision = { action: "notify"; releases: Release[]; cursor: string } | { action: "baseline"; cursor: string } | { action: "none" };

/**
 * A brand alert: `lastState` holds the newest announcement time it has
 * reported (or the alert's creation time). Fires with every announcement
 * newer than that, newest first, at most BRAND_NOTIFY_GAP_MS apart. Pure.
 */
export function decideBrand(a: StockState & { createdAt?: string }, announced: Release[], at = Date.now()): BrandDecision {
  const cursor = a.lastState && Number.isFinite(Date.parse(a.lastState)) ? a.lastState : null;
  if (!cursor) return { action: "baseline", cursor: a.createdAt && Number.isFinite(Date.parse(a.createdAt)) ? a.createdAt : new Date(at).toISOString() };
  const fresh = announced.filter((r) => r.publishedAt > cursor).sort((x, y) => y.publishedAt.localeCompare(x.publishedAt));
  if (!fresh.length) return { action: "none" };
  const last = a.lastNotifiedAt ? new Date(a.lastNotifiedAt).getTime() : NaN;
  if (Number.isFinite(last) && at - last < BRAND_NOTIFY_GAP_MS) return { action: "none" };
  return { action: "notify", releases: fresh, cursor: fresh[0].publishedAt };
}

/**
 * The order state an alert watches: its product's offers in its market, or
 * for a release every product the release names (the best of them).
 */
export function alertOrderState(a: Pick<AlertRow, "kind" | "product" | "condition" | "type">, offersOf: (slug: string) => Offer[], releaseProducts: (id: string) => string[]): OrderState {
  const slugs = a.kind === "release" ? releaseProducts(a.product) : [a.product];
  return orderState(slugs.flatMap(offersOf), a.type === "preorder" ? "new" : a.condition);
}

// ---------------------------------------------------------------- email

export const alertsFrom = () => process.env.ALERTS_FROM_EMAIL?.trim() || "CamCompare <alerts@camcompare.app>";
export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY?.trim());
export const alertsConfigured = () => Boolean(process.env.DATABASE_URL?.trim()) && emailConfigured();

export type Email = { to: string; subject: string; text: string; html: string; unsubscribeUrl?: string };

/** One email through Resend's REST API. Throws on failure (its status, never the key). */
export async function sendEmail(e: Email): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const headers: Record<string, string> = {};
  if (e.unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${e.unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: alertsFrom(), reply_to: CONTACT_EMAIL, to: [e.to], subject: e.subject, text: e.text, html: e.html, headers }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Resend answered ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
}

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** A plain email with one button, as text and HTML. */
export function emailBody({ lines, button, footer }: { lines: string[]; button: { label: string; url: string }; footer: string[] }): { text: string; html: string } {
  const text = [...lines, "", `${button.label}: ${button.url}`, "", "--", ...footer].join("\n");
  const p = (s: string) => `<p style="margin:0 0 12px">${escapeHtml(s)}</p>`;
  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111827;background:#f8f8f7;padding:24px">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:24px">
<p style="margin:0 0 16px;font-weight:700;font-size:18px">CamCompare</p>
${lines.map(p).join("\n")}
<p style="margin:20px 0"><a href="${escapeHtml(button.url)}" style="background:#1d47d1;color:#fff;text-decoration:none;padding:10px 16px;border-radius:5px;font-weight:600;display:inline-block">${escapeHtml(button.label)}</a></p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
${footer.map((s) => `<p style="margin:0 0 6px;font-size:12px;color:#6b7280">${escapeHtml(s).replace(/(https:\/\/\S+)/g, '<a href="$1" style="color:#6b7280">$1</a>')}</p>`).join("\n")}
</div></body></html>`;
  return { text, html };
}

// ---------------------------------------------------------------- storage

type Sql = ReturnType<typeof neon>;
let sql: Sql | null = null;
let sqlUrl = "";
let ready: Promise<void> | null = null;

function db(): Sql {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!sql || url !== sqlUrl) {
    sql = neon(url, { fetchOptions: { cache: "no-store" } });
    sqlUrl = url;
    ready = null;
  }
  return sql;
}

const opts = () => ({ fetchOptions: { cache: "no-store" as const, signal: AbortSignal.timeout(9000) } });

const DDL = [
  `CREATE TABLE IF NOT EXISTS price_alerts (
    id bigserial primary key,
    created_at timestamptz not null default now(),
    email text not null,
    product text not null,
    kind text not null,
    market text not null,
    condition text not null,
    target_price integer,
    last_notified_price integer,
    last_notified_at timestamptz,
    confirmed boolean not null default false,
    token text not null unique,
    active boolean not null default true
  )`,
  "CREATE INDEX IF NOT EXISTS price_alerts_email ON price_alerts (email)",
  // 2026-10-21: stock, preorder and brand alerts. Old rows are price alerts.
  "ALTER TABLE price_alerts ADD COLUMN IF NOT EXISTS alert_type text not null default 'price'",
  // restock/preorder: the order state last seen (lib/releases/stock.ts); brand: the newest announcement time reported.
  "ALTER TABLE price_alerts ADD COLUMN IF NOT EXISTS last_state text",
];

function ensureTable(s: Sql): Promise<void> {
  ready ??= (async () => {
    for (const q of DDL) {
      try {
        await s.query(q, [], opts());
      } catch (e) {
        const code = (e as { code?: string })?.code;
        if (code === "42P07" || code === "23505" || code === "42701") continue; // another instance made it first
        throw e;
      }
    }
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

export type AlertRow = {
  id: string;
  createdAt: string;
  email: string;
  product: string;
  kind: AlertSubject;
  market: MarketCode;
  condition: AlertCondition;
  type: AlertType;
  target: number | null;
  lastState: string | null;
  lastNotifiedPrice: number | null;
  lastNotifiedAt: string | null;
  confirmed: boolean;
  token: string;
  active: boolean;
};

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));
const num = (v: unknown) => (v == null ? null : Number(v));
const COLS = "id::text AS id, created_at, email, product, kind, market, condition, alert_type, target_price, last_notified_price, last_notified_at, last_state, confirmed, token, active";
const toRow = (r: Record<string, unknown>): AlertRow => ({
  id: String(r.id),
  createdAt: iso(r.created_at) ?? "",
  email: String(r.email),
  product: String(r.product),
  kind: (ALERT_SUBJECTS as readonly string[]).includes(String(r.kind)) ? (r.kind as AlertSubject) : "camera",
  market: String(r.market) as MarketCode,
  condition: (ALERT_CONDITIONS as readonly string[]).includes(String(r.condition)) ? (r.condition as AlertCondition) : "any",
  type: (ALERT_TYPES as readonly string[]).includes(String(r.alert_type)) ? (r.alert_type as AlertType) : "price",
  target: num(r.target_price),
  lastState: r.last_state == null ? null : String(r.last_state),
  lastNotifiedPrice: num(r.last_notified_price),
  lastNotifiedAt: iso(r.last_notified_at),
  confirmed: Boolean(r.confirmed),
  token: String(r.token),
  active: Boolean(r.active),
});

async function q(text: string, params: unknown[]): Promise<Record<string, unknown>[]> {
  const s = db();
  await ensureTable(s);
  return (await s.query(text, params, opts())) as Record<string, unknown>[];
}

export type CreateResult = { status: "created" | "updated"; row: AlertRow; sendConfirm: boolean } | { status: "full" };

/**
 * Save one alert. The same product, market and condition for the same email
 * updates the target instead of adding a second alert. An address that has
 * confirmed before needs no new confirmation; a new one gets a confirm email,
 * at most PENDING_PER_EMAIL waiting at once.
 * `seen`: today's price for the condition, the baseline for a no-target alert.
 * `state`: for restock and preorder alerts the order state now, for brand
 * alerts the time now: the baseline a later check compares with, so an alert
 * made while a product is already in stock waits for the next restock.
 */
export async function createAlert(a: AlertRequest, seen: number | null, state: string | null = null): Promise<CreateResult> {
  const existing = (await q(`SELECT ${COLS} FROM price_alerts WHERE email = $1 AND product = $2 AND market = $3 AND condition = $4 AND alert_type = $5 AND active ORDER BY id DESC LIMIT 1`, [a.email, a.slug, a.market, a.condition, a.type])).map(toRow)[0];
  const [{ n, confirmed, pending }] = (await q(
    "SELECT count(*) FILTER (WHERE active)::int AS n, bool_or(confirmed AND active) AS confirmed, count(*) FILTER (WHERE active AND NOT confirmed)::int AS pending FROM price_alerts WHERE email = $1",
    [a.email],
  )) as { n: number; confirmed: boolean | null; pending: number }[];
  if (existing && a.type !== "price") return { status: "updated", row: existing, sendConfirm: !existing.confirmed && !confirmed };
  if (existing) {
    const rows = (await q(`UPDATE price_alerts SET target_price = $2::integer, last_notified_price = CASE WHEN target_price IS DISTINCT FROM $2::integer THEN $3::integer ELSE last_notified_price END, last_notified_at = CASE WHEN target_price IS DISTINCT FROM $2::integer THEN NULL ELSE last_notified_at END WHERE id = $1::bigint RETURNING ${COLS}`, [
      existing.id,
      a.target,
      a.target === null ? seen : null,
    ])).map(toRow);
    return { status: "updated", row: rows[0] ?? existing, sendConfirm: !existing.confirmed && !confirmed };
  }
  if (Number(n) >= ALERTS_PER_EMAIL) return { status: "full" };
  const isConfirmed = Boolean(confirmed);
  const rows = (await q(
    `INSERT INTO price_alerts (email, product, kind, market, condition, alert_type, target_price, last_notified_price, last_state, confirmed, token) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING ${COLS}`,
    [a.email, a.slug, a.kind, a.market, a.condition, a.type, a.target, a.type === "price" && a.target === null ? seen : null, a.type === "price" ? null : state, isConfirmed, newToken()],
  )).map(toRow);
  return { status: "created", row: rows[0], sendConfirm: !isConfirmed && Number(pending) < PENDING_PER_EMAIL };
}

export async function alertByToken(token: string): Promise<AlertRow | null> {
  if (!isToken(token)) return null;
  return (await q(`SELECT ${COLS} FROM price_alerts WHERE token = $1`, [token])).map(toRow)[0] ?? null;
}

/** Confirming one alert proves the address: every alert waiting for it is confirmed. */
export async function confirmByToken(token: string): Promise<AlertRow | null> {
  const a = await alertByToken(token);
  if (!a || !a.active) return a;
  await q("UPDATE price_alerts SET confirmed = true WHERE email = $1 AND active", [a.email]);
  return { ...a, confirmed: true };
}

/** Switch one alert off (or, with all, every alert for its address). */
export async function unsubscribeByToken(token: string, all = false): Promise<AlertRow | null> {
  const a = await alertByToken(token);
  if (!a) return null;
  if (all) await q("UPDATE price_alerts SET active = false WHERE email = $1", [a.email]);
  else await q("UPDATE price_alerts SET active = false WHERE id = $1::bigint", [a.id]);
  return { ...a, active: false };
}

/** Every active alert for the address the token belongs to, newest first. */
export async function alertsForToken(token: string): Promise<{ owner: AlertRow; alerts: AlertRow[] } | null> {
  const owner = await alertByToken(token);
  if (!owner) return null;
  const alerts = (await q(`SELECT ${COLS} FROM price_alerts WHERE email = $1 AND active ORDER BY id DESC LIMIT $2`, [owner.email, ALERTS_PER_EMAIL])).map(toRow);
  return { owner, alerts };
}

/** For scripts/check-alerts.ts: every confirmed, active alert. */
export async function activeAlerts(): Promise<AlertRow[]> {
  return (await q(`SELECT ${COLS} FROM price_alerts WHERE confirmed AND active ORDER BY id`, [])).map(toRow);
}

export async function markNotified(id: string, price: number, at = new Date()): Promise<void> {
  await q("UPDATE price_alerts SET last_notified_price = $2, last_notified_at = $3 WHERE id = $1::bigint", [id, price, at.toISOString()]);
}

export async function setBaseline(id: string, price: number | null): Promise<void> {
  await q("UPDATE price_alerts SET last_notified_price = $2::integer WHERE id = $1::bigint", [id, price]);
}

/** Restock, preorder and brand alerts: remember the state (and, with `notified`, that an email went out). */
export async function setState(id: string, state: string, notified = false, at = new Date()): Promise<void> {
  if (notified) await q("UPDATE price_alerts SET last_state = $2, last_notified_at = $3 WHERE id = $1::bigint", [id, state, at.toISOString()]);
  else await q("UPDATE price_alerts SET last_state = $2 WHERE id = $1::bigint", [id, state]);
}

/** For scripts/check-watched.ts: the (market, product) pairs confirmed restock and preorder alerts watch. */
export async function watchedAlerts(): Promise<AlertRow[]> {
  return (await q(`SELECT ${COLS} FROM price_alerts WHERE confirmed AND active AND alert_type IN ('restock', 'preorder') ORDER BY id`, [])).map(toRow);
}

// ---------------------------------------------------------------- prices and messages

/** Today's cheapest offer for the alert's condition: in stock, body only, never Amazon's (lowest()). */
export function lowestFor(offers: Offer[], condition: AlertCondition): Offer | null {
  const n = condition !== "used" ? lowest(offers, "new") : null;
  const u = condition !== "new" ? lowest(offers, "used") : null;
  return !n ? u : !u ? n : u.price < n.price ? u : n;
}

export const productUrl = (kind: "camera" | "lens", slug: string, m: MarketCode) => abs(marketPath(m, `/${kind === "camera" ? "cameras" : "lenses"}/${slug}`));
export const releaseUrl = (id: string | null, m: MarketCode) => abs(marketPath(m, `/releases${id ? `#${id}` : ""}`));
/** Where an alert's subject lives on the site. */
export const subjectUrl = (a: Pick<AlertRow, "kind" | "product" | "market">) => (a.kind === "camera" || a.kind === "lens" ? productUrl(a.kind, a.product, a.market) : releaseUrl(a.kind === "release" ? a.product : null, a.market));
export const confirmUrl = (token: string) => abs(`/api/alerts/confirm?token=${token}`);
export const unsubscribeUrl = (token: string) => abs(`/api/alerts/unsubscribe?token=${token}`);
export const manageUrl = (token: string) => abs(`/alerts/manage?token=${token}`);

const conditionWord = (c: AlertCondition) => (c === "new" ? "new" : c === "used" ? "used" : "new or used");

export function describeAlert(a: Pick<AlertRow, "condition" | "target" | "market"> & { type?: AlertType }): string {
  const cur = MARKETS[a.market].currency;
  if (a.type === "restock") return `back in stock ${a.condition === "any" ? "new or used" : conditionWord(a.condition)} at a store`;
  if (a.type === "preorder") return "open for preorder or in stock at a store";
  if (a.type === "brand") return "announcing something new";
  return a.target !== null ? `${conditionWord(a.condition)} at ${price(a.target, cur)} or less` : `any ${conditionWord(a.condition)} price drop`;
}

export function confirmEmail(a: AlertRow, name: string): Email {
  const body = emailBody({
    lines: [
      a.type === "brand" ? `Please confirm you'd like an email when ${name} announces something new.` : `Please confirm you'd like an email when the ${name} (${MARKETS[a.market].short}) is ${describeAlert(a)}.`,
      "If you didn't ask for this, ignore this email and nothing will be sent.",
    ],
    button: { label: "Confirm price alert", url: confirmUrl(a.token) },
    footer: ["You're getting this because someone entered this address on camcompare.app.", `Manage your alerts: ${manageUrl(a.token)}`],
  });
  return { to: a.email, subject: `Confirm your ${a.type === "brand" ? "announcement" : a.type === "price" ? "price" : "stock"} alert: ${name}`, ...body };
}

export function priceEmail(a: AlertRow, name: string, offer: Offer, storeName: string): Email {
  const cur = MARKETS[a.market].currency;
  const p = price(offer.price, cur);
  const cond = offer.condition === "new" ? "new" : offer.condition;
  const body = emailBody({
    lines: [
      `The ${name} is ${p} ${cond} at ${storeName} (${MARKETS[a.market].name}).`,
      a.target !== null ? `Your target was ${price(a.target, cur)}.` : a.lastNotifiedPrice ? `It was ${price(a.lastNotifiedPrice, cur)} when we last told you.` : "",
      "Prices change fast: check the store before you buy.",
    ].filter(Boolean),
    button: { label: `See every price for the ${name}`, url: subjectUrl(a) },
    footer: [`Stop this alert: ${unsubscribeUrl(a.token)}`, `Manage all your alerts: ${manageUrl(a.token)}`],
  });
  return { to: a.email, subject: `Price drop: ${name} now ${p}`, unsubscribeUrl: unsubscribeUrl(a.token), ...body };
}

/** "In stock at Wex: £1,899" lines for a stock email, the store rows already chosen (storeRows). */
export function storeLines(rows: StoreRow[], m: MarketCode, storeName: (key: string) => string): string[] {
  const cur = MARKETS[m].currency;
  return rows.map((r) => `${ORDER_STATE_LABEL[r.state]} at ${storeName(r.offer.retailer)}: ${price(r.offer.price, cur)}${r.offer.kit ? " (kit)" : ""}`);
}

/** A restock or preorder email: which stores, at what price, and a link to every price. */
export function stockEmail(a: AlertRow, name: string, state: OrderState, lines: string[]): Email {
  const where = MARKETS[a.market].name;
  const headline = a.type === "restock" ? `The ${name} is back in stock in ${where}.` : state === "preorder" ? `The ${name} is open for preorder in ${where}.` : `The ${name} can be ordered in ${where}: a store has it in stock.`;
  const body = emailBody({
    lines: [headline, ...lines.slice(0, 5), "Stock like this can go in minutes. Only stores are listed here, never marketplace resellers. Check the store before you pay."],
    button: { label: a.kind === "release" ? "See the announcement and stores" : `See every store for the ${name}`, url: subjectUrl(a) },
    footer: [`Stop this alert: ${unsubscribeUrl(a.token)}`, `Manage all your alerts: ${manageUrl(a.token)}`],
  });
  const subject = a.type === "restock" ? `Back in stock: ${name}` : state === "preorder" ? `Preorder open: ${name}` : `Now available: ${name}`;
  return { to: a.email, subject, unsubscribeUrl: unsubscribeUrl(a.token), ...body };
}

/** A brand email: the new announcements, newest first (at most five named). */
export function brandEmail(a: AlertRow, brandName: string, releases: Release[]): Email {
  const shown = releases.slice(0, 5);
  const body = emailBody({
    lines: [
      releases.length === 1 ? `${brandName} just announced something:` : `${brandName} made ${releases.length} announcements:`,
      ...shown.map((r) => `• ${r.title}`),
      releases.length > shown.length ? `…and ${releases.length - shown.length} more.` : "",
      "We list which stores take orders as soon as one does.",
    ].filter(Boolean),
    button: { label: "See what's just announced", url: releaseUrl(shown[0]?.id ?? null, a.market) },
    footer: [`Stop this alert: ${unsubscribeUrl(a.token)}`, `Manage all your alerts: ${manageUrl(a.token)}`],
  });
  return { to: a.email, subject: `Just announced by ${brandName}: ${shown[0]?.title.slice(0, 80) ?? "new"}`, unsubscribeUrl: unsubscribeUrl(a.token), ...body };
}
