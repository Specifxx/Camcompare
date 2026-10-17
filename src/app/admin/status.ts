// "Anything else" on the owner's admin page: the site's state as the deployed
// data files and environment see it. Read from data/ (which every server
// function ships with, next.config.js), never from the network.
import fs from "node:fs";
import path from "node:path";
import { isPaid } from "@/lib/affiliate";
import { publishedCameras, publishedLenses } from "@/lib/catalog";
import { DATA_DIR } from "@/lib/catalog/load";
import { MARKET_CODES, type MarketCode } from "@/lib/markets";
import { historyDir, readAmazonOffers, readOffersFile, type SourceRun } from "@/lib/offers";
import { retailer, retailersFor } from "@/lib/retailers";

const countJson = (dir: string) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")).length : 0);

export function catalogStatus() {
  return {
    cameras: publishedCameras().length,
    lenses: publishedLenses().length,
    cameraFiles: countJson(path.join(DATA_DIR, "cameras")),
    lensFiles: countJson(path.join(DATA_DIR, "lenses")),
  };
}

export type RetailerRow = { key: string; name: string; source: string; offers: number; run: SourceRun | null; paid: boolean };
export type MarketStatus = {
  market: MarketCode;
  generatedAt: string | null;
  offers: number;
  products: number;
  amazonOffers: number;
  historyDays: number;
  lastHistoryDay: string | null;
  retailers: RetailerRow[];
  error?: string;
};

export function marketStatus(m: MarketCode): MarketStatus {
  const empty: MarketStatus = { market: m, generatedAt: null, offers: 0, products: 0, amazonOffers: 0, historyDays: 0, lastHistoryDay: null, retailers: [] };
  try {
    const file = readOffersFile(m);
    const byRetailer = new Map<string, number>();
    for (const o of file.offers) byRetailer.set(o.retailer, (byRetailer.get(o.retailer) ?? 0) + 1);
    const keys = new Set([...retailersFor(m).map((r) => r.key), ...Object.keys(file.sources), ...byRetailer.keys()]);
    const retailers = [...keys]
      .map((k) => ({ key: k, name: retailer(k)?.name ?? k, source: retailer(k)?.source ?? "unknown", offers: byRetailer.get(k) ?? 0, run: file.sources[k] ?? null, paid: isPaid(k) }))
      .sort((a, b) => b.offers - a.offers || a.name.localeCompare(b.name));
    const dir = historyDir(m);
    const days = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort() : [];
    return {
      ...empty,
      generatedAt: file.generatedAt,
      offers: file.offers.length,
      products: new Set(file.offers.map((o) => o.product)).size,
      amazonOffers: readAmazonOffers(m).length,
      historyDays: days.length,
      lastHistoryDay: days.length ? days[days.length - 1].slice(0, 10) : null,
      retailers,
    };
  } catch (e) {
    return { ...empty, error: String((e as Error).message ?? e).slice(0, 300) };
  }
}

export const allMarketStatus = () => MARKET_CODES.map(marketStatus);

/** Which Vercel variables this deployment has: set or not, never a value. */
export function envStatus(): { label: string; set: number; of: number }[] {
  const has = (k: string) => Boolean(process.env[k]?.trim());
  const group = (label: string, keys: string[]) => ({ label, set: keys.filter(has).length, of: keys.length });
  const deeplinks = Object.keys(process.env).filter((k) => k.startsWith("AFFILIATE_DEEPLINK_"));
  return [
    group("Site URL (NEXT_PUBLIC_SITE_URL)", ["NEXT_PUBLIC_SITE_URL"]),
    group("Feedback database (DATABASE_URL)", ["DATABASE_URL"]),
    group("Amazon store tags", ["AMAZON_TAG_US", "AMAZON_TAG_UK", "AMAZON_TAG_DE", "AMAZON_TAG_AU", "AMAZON_TAG_SG"]),
    group("Amazon Creators API", ["AMAZON_CREATORS_NA_CLIENT_ID", "AMAZON_CREATORS_EU_CLIENT_ID", "AMAZON_CREATORS_FE_CLIENT_ID"]),
    group("eBay campaign", ["EBAY_AFFILIATE_CAMPAIGN"]),
    { label: "Retailer deep links set", set: deeplinks.filter(has).length, of: retailersWithDeeplinks() },
    group("AdSense", ["NEXT_PUBLIC_ADSENSE_CLIENT"]),
    group("Search verification", ["GOOGLE_SITE_VERIFICATION", "BING_SITE_VERIFICATION"]),
  ];
}

const retailersWithDeeplinks = () => MARKET_CODES.flatMap(retailersFor).filter((r) => r.network && !r.amazon && !r.ebay).length;
