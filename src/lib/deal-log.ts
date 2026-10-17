// The home page's deal feed (views/HomeView.tsx, components/home/DealFeed.tsx):
// friends asked for "OzBargain": a feed you want to snatch from, where a deal
// that sells says so the next time you look. The page is static, so the
// memory lives in a committed public file per market, data/deal-log/<m>.json,
// updated after every price import (scripts/update-deal-log.ts):
//   - a deal is one product + condition + retailer, found by homeDeals (the
//     cheapest in-stock, body-only, non-Amazon offer against this market's RRP);
//   - it stays "live" while that retailer still has the product in stock in
//     that condition and it still saves at least MIN_PCT; its price follows
//     the retailer's cheapest such offer, and a drop keeps the old price
//     ("was $X", "price dropped");
//   - it turns "gone" when the retailer no longer lists it in stock ("sold")
//     or its price rises out of deal territory ("expired"), and is dropped
//     GONE_KEEP_DAYS later.
// No URLs: the page wraps the live offer's own link at build time. Amazon
// never enters (lowest() leaves it out), so nothing of Amazon's is stored.
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { homeDeals, type HomeDealInput } from "./deals-home";
import { CURRENCIES, MARKET_CODES, type Currency, type MarketCode } from "./markets";
import { isAmazonOffer, type Offer } from "./offers";
import { CONDITIONS, type Condition } from "./retailers";

export const DEAL_LOG_DIR = path.join(process.cwd(), "data", "deal-log");
export const dealLogFile = (m: MarketCode) => path.join(DEAL_LOG_DIR, `${m}.json`);
/** A gone deal stays in the file this long (the page shows the last 48 hours of them). */
export const GONE_KEEP_DAYS = 7;
export const MIN_PCT = 5;

export const dealEntrySchema = z
  .object({
    key: z.string(),
    slug: z.string(),
    kind: z.enum(["camera", "lens"]),
    condition: z.enum(CONDITIONS as [Condition, ...Condition[]]),
    retailer: z.string(),
    price: z.number().int().positive(),
    rrp: z.number().int().positive(),
    save: z.number().int(),
    pct: z.number().int(),
    /** The price before the latest drop on this live deal. */
    was: z.number().int().positive().optional(),
    droppedAt: z.string().optional(),
    firstSeen: z.string(),
    lastSeen: z.string(),
    status: z.enum(["live", "gone"]),
    goneAt: z.string().optional(),
    /** "sold": no longer in stock there; "expired": still listed, no longer a deal. */
    goneWhy: z.enum(["sold", "expired"]).optional(),
  })
  .strict();
export type DealEntry = z.infer<typeof dealEntrySchema>;

export const dealLogSchema = z.object({
  market: z.enum(MARKET_CODES),
  currency: z.enum(CURRENCIES),
  updatedAt: z.string().nullable(),
  deals: z.array(dealEntrySchema),
});
export type DealLog = z.infer<typeof dealLogSchema>;

export const dealKey = (slug: string, condition: Condition, retailer: string) => `${slug}|${condition}|${retailer}`;

export function readDealLog(m: MarketCode, file = dealLogFile(m)): DealLog | null {
  if (!fs.existsSync(file)) return null;
  return dealLogSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
}

/** One deal per line, for readable diffs. */
export function writeDealLog(log: DealLog, file = dealLogFile(log.market)): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const head = JSON.stringify({ market: log.market, currency: log.currency, updatedAt: log.updatedAt });
  const body = log.deals.map((d) => "    " + JSON.stringify(d)).join(",\n");
  fs.writeFileSync(file, `${head.slice(0, -1)},\n  "deals": [\n${body}${body ? "\n" : ""}  ]\n}\n`);
}

/** The retailer's cheapest in-stock, body-only, non-Amazon offer in exactly this condition. */
function cheapestAt(offers: Offer[], retailer: string, condition: Condition): Offer | null {
  let best: Offer | null = null;
  for (const o of offers) {
    if (o.retailer !== retailer || o.condition !== condition || o.kit || !o.inStock || isAmazonOffer(o)) continue;
    if (!best || o.price < best.price) best = o;
  }
  return best;
}

const pctOf = (save: number, rrp: number) => Math.round((save / rrp) * 100);

/**
 * The next log from the previous one and this import's offers. `now` is the
 * import's own time (the offers file's generatedAt), so a rerun is stable.
 */
export function updateDealLog(prev: DealLog | null, items: HomeDealInput[], ctx: { market: MarketCode; currency: Currency; now: string; minPct?: number }): DealLog {
  const { now, minPct = MIN_PCT } = ctx;
  const bySlug = new Map(items.map((it) => [it.slug, it]));
  const out = new Map<string, DealEntry>();
  const nowT = Date.parse(now);

  // 1. What we already had: still live, repriced, sold, expired, or aged out.
  for (const d of prev?.deals ?? []) {
    if (d.status === "gone") {
      if (d.goneAt && nowT - Date.parse(d.goneAt) > GONE_KEEP_DAYS * 86_400_000) continue;
      out.set(d.key, d);
      continue;
    }
    const it = bySlug.get(d.slug);
    const rrp = it?.rrpMinor ?? d.rrp;
    const o = it ? cheapestAt(it.offers, d.retailer, d.condition) : null;
    if (!o) {
      out.set(d.key, { ...d, status: "gone", goneAt: now, goneWhy: "sold" });
      continue;
    }
    const save = rrp - o.price;
    const pct = pctOf(save, rrp);
    if (save <= 0 || pct < minPct) {
      out.set(d.key, { ...d, status: "gone", goneAt: now, goneWhy: "expired" });
      continue;
    }
    const next: DealEntry = { ...d, price: o.price, rrp, save, pct, lastSeen: now };
    if (o.price < d.price) {
      next.was = d.price;
      next.droppedAt = now;
    } else if (o.price > d.price) {
      delete next.was;
      delete next.droppedAt;
    }
    out.set(d.key, next);
  }

  // 2. Today's deals that are new (or back after selling out: a fresh find).
  for (const mode of ["used", "new"] as const) {
    for (const h of homeDeals(items, mode, { minPct, max: Infinity })) {
      const key = dealKey(h.slug, h.condition, h.retailer);
      const had = out.get(key);
      if (had && had.status === "live") continue;
      out.set(key, { key, slug: h.slug, kind: h.kind, condition: h.condition, retailer: h.retailer, price: h.price, rrp: h.rrp, save: h.save, pct: h.pct, firstSeen: now, lastSeen: now, status: "live" });
    }
  }

  const deals = [...out.values()].sort((a, b) => a.key.localeCompare(b.key));
  return { market: ctx.market, currency: ctx.currency, updatedAt: now, deals };
}
