// The daily price import: run every source, merge with yesterday's file,
// write data/offers/latest.json and today's price-history file.
// Pure apart from `runImport`'s file writes, so tests drive `mergeOffers` and
// `historyFor` directly.
import fs from "node:fs";
import path from "node:path";
import type { Camera } from "./catalog/schema";
import { buildIndex } from "./matching";
import { HISTORY_DIR, OFFER_MAX_AGE_H, OFFERS_FILE, lowest, readOffersFile, type HistoryDay, type Offer, type OffersFile, type SourceRun } from "./offers";
import type { PriceSource, SourceResult } from "./sources/types";

/**
 * A source that ran replaces its offers. One that FAILED keeps yesterday's
 * (a broken feed must not empty every page) until they are OFFER_MAX_AGE_H
 * old. One that is not configured contributes nothing. A retailer this run
 * did not include (IMPORT_ONLY) keeps its offers on the same terms as a failure.
 */
export function mergeOffers(prev: OffersFile, results: Record<string, SourceResult>, now: string, cameraSlugs: Set<string>): Offer[] {
  const cutoff = Date.parse(now) - OFFER_MAX_AGE_H * 3600_000;
  const out: Offer[] = [];
  const keepPrev = (retailer: string) => prev.offers.filter((o) => o.retailer === retailer && Date.parse(o.seenAt) >= cutoff);
  for (const [retailer, r] of Object.entries(results)) {
    if (r.status === "ok") out.push(...r.offers);
    else if (r.status === "error") out.push(...keepPrev(retailer));
  }
  for (const retailer of new Set(prev.offers.map((o) => o.retailer))) if (!(retailer in results)) out.push(...keepPrev(retailer));
  // A camera removed from the catalog takes its offers with it.
  return out.filter((o) => cameraSlugs.has(o.camera)).sort((a, b) => a.camera.localeCompare(b.camera) || a.priceCents - b.priceCents);
}

export function historyFor(day: string, offers: Offer[]): HistoryDay {
  const byCamera = new Map<string, Offer[]>();
  for (const o of offers) (byCamera.get(o.camera) ?? byCamera.set(o.camera, []).get(o.camera)!).push(o);
  const prices: HistoryDay["prices"] = {};
  for (const [slug, list] of [...byCamera].sort(([a], [b]) => a.localeCompare(b))) {
    const n = lowest(list, "new");
    const u = lowest(list, "used");
    if (n || u) prices[slug] = { ...(n ? { new: n.priceCents } : {}), ...(u ? { used: u.priceCents } : {}) };
  }
  return { day, currency: "USD", prices };
}

export async function runImport(cameras: Camera[], sources: PriceSource[], log = console.log): Promise<OffersFile> {
  const now = new Date().toISOString();
  const index = buildIndex(cameras);
  const results: Record<string, SourceResult> = {};
  const runs: Record<string, SourceRun> = {};
  for (const s of sources) {
    let r: SourceResult;
    try {
      r = await s.run({ cameras, index, now, log });
    } catch (e) {
      r = { status: "error", note: (e as Error).message.slice(0, 300) };
    }
    results[s.retailer] = r;
    runs[s.retailer] = { status: r.status, offers: r.status === "ok" ? r.offers.length : 0, ...(r.note ? { note: r.note } : {}), at: now };
    log(`${s.retailer}: ${r.status}${r.status === "ok" ? ` ${r.offers.length} offers` : ""}${r.note ? ` (${r.note})` : ""}`);
  }
  const prev = readOffersFile();
  const offers = mergeOffers(prev, results, now, new Set(cameras.map((c) => c.slug)));
  const file: OffersFile = { generatedAt: now, market: "US", sources: { ...prev.sources, ...runs }, offers };
  fs.mkdirSync(path.dirname(OFFERS_FILE), { recursive: true });
  fs.writeFileSync(OFFERS_FILE, JSON.stringify(file, null, 1) + "\n");
  const day = now.slice(0, 10);
  const history = historyFor(day, offers);
  if (Object.keys(history.prices).length) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
    fs.writeFileSync(path.join(HISTORY_DIR, `${day}.json`), JSON.stringify(history) + "\n");
  }
  log(`${offers.length} offers for ${new Set(offers.map((o) => o.camera)).size} cameras`);
  return file;
}
