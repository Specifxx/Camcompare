// The daily price import: for each market, run its sources, merge with the
// last run, write data/offers/<market>.json and today's history file.
// Pure apart from `runImport`'s file writes, so tests drive `mergeOffers` and
// `historyFor` directly.
import fs from "node:fs";
import path from "node:path";
import type { Camera, Lens } from "./catalog/schema";
import { MARKETS, type MarketCode } from "./markets";
import { buildIndex } from "./matching";
import { AMAZON_MAX_AGE_H, historyDir, lowest, OFFER_MAX_AGE_H, offersFile, readOffersFile, type HistoryDay, type Offer, type OffersFile, type SourceRun } from "./offers";
import { retailer } from "./retailers";
import { sourcesFor } from "./sources";
import type { PriceSource, SourceResult } from "./sources/types";

/**
 * A source that ran replaces its offers (only for the products it covered,
 * when it says which). One that FAILED keeps yesterday's — a broken feed must
 * not empty every page — until they are OFFER_MAX_AGE_H old (Amazon's,
 * AMAZON_MAX_AGE_H: its terms forbid showing an older price). One that is not
 * configured contributes nothing. A retailer this run did not include
 * (IMPORT_ONLY) keeps its offers on the same terms as a failure.
 */
export function mergeOffers(prev: OffersFile, results: Record<string, SourceResult>, now: string, slugs: Set<string>): Offer[] {
  const fresh = (o: Offer) => Date.parse(now) - Date.parse(o.seenAt) <= (retailer(o.retailer)?.amazon ? AMAZON_MAX_AGE_H : OFFER_MAX_AGE_H) * 3600_000;
  const keepPrev = (key: string, except?: Set<string>) => prev.offers.filter((o) => o.retailer === key && fresh(o) && !except?.has(o.product));
  const out: Offer[] = [];
  for (const [key, r] of Object.entries(results)) {
    if (r.status === "ok") {
      out.push(...r.offers);
      if (r.covered) out.push(...keepPrev(key, new Set(r.covered)));
    } else if (r.status === "error") out.push(...keepPrev(key));
  }
  for (const key of new Set(prev.offers.map((o) => o.retailer))) if (!(key in results) && retailer(key)) out.push(...keepPrev(key));
  // A product removed from the catalog takes its offers with it.
  return out.filter((o) => slugs.has(o.product)).sort((a, b) => a.product.localeCompare(b.product) || a.price - b.price);
}

// Run notes are committed with the offers, and a fetch error can quote the
// URL it failed on: a feed URL carries the account's credentials.
const SECRET_ENV = /^(FEED_URL_|AFFILIATE_DEEPLINK_|AMAZON_|EBAY_|BESTBUY_)/;
export function redact(note: string, env: Record<string, string | undefined> = process.env): string {
  let out = note;
  for (const [k, v] of Object.entries(env)) if (SECRET_ENV.test(k) && v && v.length >= 8) out = out.split(v).join(`[${k}]`);
  return out.replace(/https?:\/\/[^\s"')]+[?&][^\s"')]*/g, (u) => u.split("?")[0] + "?[…]");
}

export function historyFor(market: MarketCode, day: string, offers: Offer[]): HistoryDay {
  const byProduct = new Map<string, Offer[]>();
  for (const o of offers) (byProduct.get(o.product) ?? byProduct.set(o.product, []).get(o.product)!).push(o);
  const prices: HistoryDay["prices"] = {};
  for (const [slug, list] of [...byProduct].sort(([a], [b]) => a.localeCompare(b))) {
    const n = lowest(list, "new");
    const u = lowest(list, "used");
    if (n || u) prices[slug] = { ...(n ? { new: n.price } : {}), ...(u ? { used: u.price } : {}) };
  }
  return { day, market, currency: MARKETS[market].currency, prices };
}

export async function runMarket(market: MarketCode, cameras: Camera[], lenses: Lens[], sources: PriceSource[], log = console.log): Promise<OffersFile> {
  const now = new Date().toISOString();
  const index = buildIndex(cameras, lenses);
  const prev = readOffersFile(market);
  const results: Record<string, SourceResult> = {};
  const runs: Record<string, SourceRun> = {};
  for (const s of sources) {
    const r = retailer(s.retailer);
    if (!r) continue;
    let res: SourceResult;
    try {
      res = await s.run({ market, retailer: r, cameras, lenses, index, now, prev, log });
    } catch (e) {
      res = { status: "error", note: (e as Error).message };
    }
    if (res.note) res = { ...res, note: redact(res.note).slice(0, 300) };
    results[s.retailer] = res;
    runs[s.retailer] = { status: res.status, offers: res.status === "ok" ? res.offers.length : 0, ...(res.note ? { note: res.note } : {}), at: now };
    log(`[${market}] ${s.retailer}: ${res.status}${res.status === "ok" ? ` ${res.offers.length} offers` : ""}${res.note ? ` (${res.note})` : ""}`);
  }
  const slugs = new Set([...cameras, ...lenses].map((p) => p.slug));
  const offers = mergeOffers(prev, results, now, slugs);
  const file: OffersFile = { generatedAt: now, market, currency: MARKETS[market].currency, sources: { ...prev.sources, ...runs }, offers };
  fs.mkdirSync(path.dirname(offersFile(market)), { recursive: true });
  fs.writeFileSync(offersFile(market), JSON.stringify(file, null, 1) + "\n");
  const day = now.slice(0, 10);
  const history = historyFor(market, day, offers);
  if (Object.keys(history.prices).length) {
    fs.mkdirSync(historyDir(market), { recursive: true });
    fs.writeFileSync(path.join(historyDir(market), `${day}.json`), JSON.stringify(history) + "\n");
  }
  log(`[${market}] ${offers.length} offers for ${new Set(offers.map((o) => o.product)).size} products`);
  return file;
}

export async function runImport(markets: MarketCode[], cameras: Camera[], lenses: Lens[], only?: string[], log = console.log) {
  for (const m of markets) {
    const sources = sourcesFor(m).filter((s) => !only || only.includes(s.retailer));
    await runMarket(m, cameras, lenses, sources, log);
  }
}
