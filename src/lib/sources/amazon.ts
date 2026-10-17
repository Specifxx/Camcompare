// Amazon Creators API (PA-API 5 was retired in 2026; calls to it now 403).
// OAuth client credentials against the region's token endpoint (one
// credential per region: NA = US, EU = UK and DE, FE = AU and SG), then:
//  1. discovery, in the daily import (`amazonSource`): searchItems for
//     products whose ASIN in this marketplace we don't know yet (a daily
//     budget), matching every result through lib/matching.ts. Found ASINs go
//     in data/amazon-asins.json, which may be stored;
//  2. pricing, in every build (`amazonPrices`, scripts/fetch-amazon-prices.ts):
//     getItems for every known ASIN, ten per call, OffersV2 only, written to
//     the git-ignored data/offers-amazon/. The licence allows a price to be
//     kept for 24 hours, so prices are never committed.
// Docs: https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction
// NOTE: written from the published docs, not yet exercised against a live
// account; scripts/check-sources.ts reports the first real run.
import fs from "node:fs";
import path from "node:path";
import type { Camera, Lens } from "../catalog/schema";
import { matchListing, plausiblePrice, type buildIndex } from "../matching";
import { MARKETS, type Currency, type MarketCode } from "../markets";
import type { Offer } from "../offers";
import type { Condition, Retailer } from "../retailers";
import { searchPhrase, sleep, type PriceSource } from "./types";

const API = "https://creatorsapi.amazon/catalog/v1";
const REGION: Record<string, { token: string; env: string }> = {
  "www.amazon.com": { token: "https://api.amazon.com/auth/o2/token", env: "NA" },
  "www.amazon.co.uk": { token: "https://api.amazon.co.uk/auth/o2/token", env: "EU" },
  "www.amazon.de": { token: "https://api.amazon.co.uk/auth/o2/token", env: "EU" },
  "www.amazon.com.au": { token: "https://api.amazon.co.jp/auth/o2/token", env: "FE" },
  "www.amazon.sg": { token: "https://api.amazon.co.jp/auth/o2/token", env: "FE" },
};
const OFFER_RESOURCES = ["itemInfo.title", "offersV2.listings.price", "offersV2.listings.condition", "offersV2.listings.availability", "offersV2.listings.merchantInfo"];

const ASIN_FILE = path.join(process.cwd(), "data", "amazon-asins.json");
type AsinCache = Record<string, Record<string, { asin: string | null; checked: string }>>;
export const readAsins = (): AsinCache => (fs.existsSync(ASIN_FILE) ? JSON.parse(fs.readFileSync(ASIN_FILE, "utf8")) : {});
const writeAsins = (c: AsinCache) => fs.writeFileSync(ASIN_FILE, JSON.stringify(c, null, 1) + "\n");

type Listing = { price?: { money?: { amount?: number; currency?: string } }; condition?: { value?: string }; availability?: { type?: string }; merchantInfo?: { name?: string } };
type Item = { asin: string; detailPageURL?: string; itemInfo?: { title?: { displayValue?: string } }; offersV2?: { listings?: Listing[] } | null };

const cond = (v: string | undefined): Condition | null => (v === "New" ? "new" : v === "Used" ? "used" : v === "Refurbished" ? "refurbished" : null);
const RECHECK_MISSING_DAYS = 30;
// OffersV2 availability types that can be bought today; IN_STOCK_SCARCE is "Only 3 left".
const IN_STOCK = new Set(["IN_STOCK", "IN_STOCK_SCARCE"]);

type Call = (op: "searchItems" | "getItems", body: object) => Promise<{ searchResult?: { items?: Item[] }; itemsResult?: { items?: Item[] } }>;

/** A signed-in API caller for this retailer's marketplace, or why there isn't one. */
async function client(r: Retailer, market: MarketCode): Promise<{ call: Call; marketplace: string } | { skip: string }> {
  const marketplace = r.amazon?.marketplace ?? "";
  const region = REGION[marketplace];
  const id = process.env[`AMAZON_CREATORS_${region?.env}_CLIENT_ID`] || (region?.env === "NA" ? process.env.AMAZON_CREATORS_CLIENT_ID : "") || "";
  const secret = process.env[`AMAZON_CREATORS_${region?.env}_CLIENT_SECRET`] || (region?.env === "NA" ? process.env.AMAZON_CREATORS_CLIENT_SECRET : "") || "";
  const tag = (r.amazon && process.env[r.amazon.tagEnv]) || (market === "us" ? process.env.AMAZON_ASSOCIATE_TAG : "") || "";
  if (!region || !id || !secret || !tag) return { skip: `Creators API ${region?.env ?? "?"} credentials or ${r.amazon?.tagEnv} not set` };
  const tok = await fetch(region.token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: id, client_secret: secret, scope: "creatorsapi::default" }),
  });
  if (!tok.ok) throw new Error(`Amazon token ${tok.status}`);
  const bearer = ((await tok.json()) as { access_token: string }).access_token;
  const call: Call = async (op, body) => {
    const res = await fetch(`${API}/${op}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json", "x-marketplace": marketplace },
      body: JSON.stringify({ partnerTag: tag, marketplace, ...body }),
    });
    await sleep(1100); // 1 request/second until Amazon raises the limit
    if (!res.ok) throw new Error(`Amazon ${op} ${res.status} ${(await res.text()).slice(0, 160)}`);
    return (await res.json()) as Awaited<ReturnType<Call>>;
  };
  return { call, marketplace };
}

const productsOf = (cameras: Camera[], lenses: Lens[]) => [...cameras.map((c) => ({ kind: "camera" as const, item: c })), ...lenses.map((l) => ({ kind: "lens" as const, item: l }))];

/** The daily import's half: find ASINs. Returns no offers; prices come from the build. */
export const amazonSource = (retailerKey: string): PriceSource => ({
  retailer: retailerKey,
  async run({ market, retailer: r, cameras, lenses, index, now, log }) {
    const c = await client(r, market);
    if ("skip" in c) return { status: "skipped", note: c.skip };
    const { call, marketplace } = c;
    const cache = readAsins();
    const known = (cache[marketplace] ??= {});
    if (market === "us") for (const cam of cameras) if (cam.amazonAsin && !known[cam.slug]) known[cam.slug] = { asin: cam.amazonAsin, checked: now };
    const stale = (k: { checked: string } | undefined) => !k || (Date.parse(now) - Date.parse(k.checked)) / 86400_000 > RECHECK_MISSING_DAYS;
    const toFind = productsOf(cameras, lenses)
      .filter(({ item }) => !known[item.slug]?.asin && stale(known[item.slug]))
      .slice(0, Number(process.env.AMAZON_SEARCH_BUDGET || 150));
    let found = 0;
    for (const { kind, item } of toFind) {
      try {
        const body = await call("searchItems", { keywords: searchPhrase(item), resources: ["itemInfo.title"], itemCount: 10 });
        const hit = (body.searchResult?.items ?? []).find((it) => {
          const m = matchListing({ title: it.itemInfo?.title?.displayValue ?? "" }, index, kind);
          return m.product !== null && m.product.slug === item.slug && !m.kit;
        });
        known[item.slug] = { asin: hit?.asin ?? null, checked: now };
        if (hit) found++;
      } catch (e) {
        log(`${r.key}: search ${item.slug}: ${(e as Error).message}`);
        break;
      }
    }
    writeAsins(cache);
    const asins = Object.values(known).filter((k) => k.asin).length;
    return { status: "ok", offers: [], note: `${asins} ASINs known, ${found}/${toFind.length} new found; prices are fetched by the build` };
  },
});

/** The build's half: today's prices for every known ASIN. */
export async function amazonPrices(r: Retailer, market: MarketCode, cameras: Camera[], lenses: Lens[], index: ReturnType<typeof buildIndex>, now: string): Promise<{ offers: Offer[]; note: string }> {
  const c = await client(r, market);
  if ("skip" in c) return { offers: [], note: c.skip };
  const { call, marketplace } = c;
  const currency: Currency = MARKETS[market].currency;
  const bySlug = new Map(productsOf(cameras, lenses).map((p) => [p.item.slug, p]));
  const known = readAsins()[marketplace] ?? {};
  const asins = Object.entries(known).filter(([slug, k]) => k.asin && bySlug.has(slug)) as [string, { asin: string }][];
  const offers: Offer[] = [];
  let failed = 0;
  for (let i = 0; i < asins.length; i += 10) {
    const batch = asins.slice(i, i + 10);
    let body;
    try {
      body = await call("getItems", { itemIds: batch.map(([, k]) => k.asin), itemIdType: "ASIN", resources: OFFER_RESOURCES });
    } catch {
      failed++;
      continue;
    }
    for (const it of body.itemsResult?.items ?? []) {
      const slug = batch.find(([, k]) => k.asin === it.asin)?.[0];
      const p = slug ? bySlug.get(slug) : undefined;
      if (!p) continue;
      const matchable = index.bySlug.get(p.item.slug)!;
      for (const l of it.offersV2?.listings ?? []) {
        const cond_ = cond(l.condition?.value);
        const amount = l.price?.money?.amount;
        if (!cond_ || !amount || l.price?.money?.currency !== currency) continue;
        if (!plausiblePrice(matchable, cond_, amount, currency)) continue;
        offers.push({
          product: p.item.slug,
          kind: p.kind,
          retailer: r.key,
          condition: cond_,
          price: Math.round(amount * 100),
          currency,
          url: it.detailPageURL || `https://${marketplace}/dp/${it.asin}`,
          title: it.itemInfo?.title?.displayValue ?? p.item.name,
          seller: l.merchantInfo?.name && !/^amazon/i.test(l.merchantInfo.name) ? l.merchantInfo.name : null,
          inStock: IN_STOCK.has(l.availability?.type ?? ""),
          kit: false,
          mount: null,
          seenAt: now,
          sourceId: it.asin,
        });
      }
    }
  }
  return { offers, note: `${asins.length} ASINs, ${offers.length} offers${failed ? `, ${failed} calls failed` : ""}` };
}
