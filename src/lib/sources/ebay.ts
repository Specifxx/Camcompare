// eBay Browse API, the same integration RiftCompare runs (src/lib/ebay.ts
// there): client-credentials token, item_summary/search, and the EPN
// campaign in X-EBAY-C-ENDUSERCTX so eBay returns itemAffiliateWebUrl.
// One search per product per market, fixed-price only, items located in the
// market's country; every result still has to pass lib/matching.ts as THAT
// product. Quota: 5,000 Browse calls a day shared by every eBay market, so
// each market gets an equal share and walks the catalog in a daily rotation;
// products it skips keep their earlier offers (`covered`).
import { ebayCampaign } from "../affiliate";
import { readViral } from "../curated";
import { launchIn, matchListing, plausiblePrice, type Matchable } from "../matching";
import { MARKETS, refRate, type Currency } from "../markets";
import type { Offer } from "../offers";
import { RETAILERS, type Condition } from "../retailers";
import { searchPhrase, sleep, toMinor, type PriceSource } from "./types";

const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const CATEGORY = { camera: "625", lens: "3323" } as const; // Cameras & Photo; Lenses

// eBay condition ids: https://developer.ebay.com/api-docs/sell/static/metadata/condition-id-values.html
function condition(id: string | undefined): Condition | null {
  switch (id) {
    case "1000":
      return "new";
    case "1500":
    case "1750":
      return "open-box";
    case "2000":
    case "2010":
    case "2020":
    case "2030":
    case "2500":
      return "refurbished";
    case "3000":
    case "4000":
    case "5000":
    case "6000":
      return "used";
    default:
      return null; // 7000 = for parts
  }
}

type Summary = {
  itemId: string;
  title: string;
  price?: { value: string; currency: string; convertedFromCurrency?: string };
  conditionId?: string;
  itemWebUrl: string;
  itemAffiliateWebUrl?: string;
  seller?: { username?: string; feedbackPercentage?: string };
  shippingOptions?: { shippingCost?: { value?: string; currency?: string } }[];
};

/** A central postcode per eBay country: sent as the buyer's location so eBay quotes real postage there. */
export const BUYER_ZIP: Record<string, string> = { US: "64101", GB: "B1 1AA", DE: "60311", AU: "2000" };

/**
 * The postage eBay states for a listing, in minor units (0 = free), or null when it states none ("calculated") or
 * states it in another currency. Visitor feedback on WargameCompare (2026-10-31): a price without its postage made
 * eBay rows "a lot of wasted clicks", so a listing with unknown postage is never an offer, and the offer's price is
 * the delivered price (item + postage).
 */
export function statedPostage(it: Pick<Summary, "shippingOptions">, currency: string): number | null {
  const c = it.shippingOptions?.[0]?.shippingCost;
  if (!c || c.value == null || !/^\d{1,6}(\.\d{1,2})?$/.test(c.value) || (c.currency && c.currency !== currency)) return null;
  return Math.round(Number(c.value) * 100);
}

let cachedToken: { value: string; until: number } | null = null;
async function token(id: string, secret: string): Promise<string> {
  if (cachedToken && cachedToken.until > Date.now()) return cachedToken.value;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
  });
  if (!res.ok) throw new Error(`eBay token ${res.status}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: body.access_token, until: Date.now() + (body.expires_in - 120) * 1000 };
  return cachedToken.value;
}

/**
 * The lowest price worth asking eBay for: plausiblePrice's used floor, in
 * whole units. Sorted by price, a camera search's first hundred results are
 * otherwise straps and batteries, and the body never makes the page.
 */
export function priceFloor(p: Pick<Matchable, "launchPriceUsd" | "launchPrices">, currency: Currency): number {
  const launch = launchIn(p, currency);
  return Math.floor(launch ? launch * 0.12 : 30 * refRate(currency));
}

const KEEP_PER_CONDITION = 3;
const MIN_SELLER_FEEDBACK = 98;

/**
 * The import runs every three hours, so the day's eBay calls are split across its runs and markets:
 * EBAY_DAILY_CAP (default 2,500, CamCompare's half of a keyset shared with K Young; owner, 2026-10-30)
 * over EBAY_RUNS_PER_DAY (8) plus one spare run, so a manual run never takes the day past the cap.
 * The slot moves the rotation window on every run, not once a day.
 */
export function ebayRunBudget(markets: number, now: string, env: Record<string, string | undefined> = process.env) {
  const cap = Math.min(2500, Number(env.EBAY_DAILY_CAP || 2500));
  const runs = Math.max(1, Number(env.EBAY_RUNS_PER_DAY || 8));
  return { perRun: Math.floor(cap / (runs + 1) / Math.max(1, markets)), slot: Math.floor(Date.parse(now) / (86400_000 / runs)) };
}

export function dailyWindow<T>(items: T[], budget: number, day: number): T[] {
  if (budget >= items.length) return items;
  const start = (day * budget) % items.length;
  return [...items.slice(start), ...items.slice(0, start)].slice(0, budget);
}

/** Share of each run's searches kept for the hot list. */
export const HOT_SHARE = 0.6;
const RECENT_DAYS = 730;

/**
 * What a run searches, hot first (owner, 2026-10-30: popular, front-page and recent products get
 * eBay prices first). Hot = the viral list (the home page's and /viral-cameras' picks) and anything
 * announced in the last two years; it rotates through HOT_SHARE of the budget, so each hot product
 * is searched several times a day. Everything else rotates through the rest, newest first, and any
 * budget the hot list doesn't need goes to it.
 */
export function ebayQueue<E extends { item: { slug: string; announced: string } }>(items: E[], budget: number, slot: number, now: string, hotSlugs: Set<string>): E[] {
  const cutoff = new Date(Date.parse(now) - RECENT_DAYS * 86400_000).toISOString().slice(0, 10);
  const newest = (a: E, b: E) => b.item.announced.localeCompare(a.item.announced) || a.item.slug.localeCompare(b.item.slug);
  const isHot = (x: E) => hotSlugs.has(x.item.slug) || x.item.announced >= cutoff;
  const hot = items.filter(isHot).sort((a, b) => Number(hotSlugs.has(b.item.slug)) - Number(hotSlugs.has(a.item.slug)) || newest(a, b));
  const rest = items.filter((x) => !isHot(x)).sort(newest);
  const fromHot = dailyWindow(hot, Math.min(hot.length, Math.ceil(budget * HOT_SHARE)), slot);
  return [...fromHot, ...dailyWindow(rest, Math.max(0, budget - fromHot.length), slot)];
}

function viralSlugs(): Set<string> {
  try {
    return new Set(readViral().cameras.map((c) => c.slug));
  } catch {
    return new Set();
  }
}

export const ebaySource = (retailerKey: string): PriceSource => ({
  retailer: retailerKey,
  async run({ market, retailer: r, cameras, lenses, index, now, log }) {
    const id = process.env.EBAY_CLIENT_ID || "";
    const secret = process.env.EBAY_CLIENT_SECRET || "";
    if (!id || !secret || !r.ebay) return { status: "skipped", note: "EBAY_CLIENT_ID / EBAY_CLIENT_SECRET not set" };
    // The owner's hard-coded EPN campaign (lib/affiliate.ts), so live listings come back tagged.
    const campaign = ebayCampaign();
    const currency = MARKETS[market].currency;
    const ebayMarkets = RETAILERS.filter((x) => x.ebay).length;
    const { perRun: budget, slot: day } = ebayRunBudget(ebayMarkets, now);
    // eBay matches are title-only, and plausiblePrice trusts no title match for
    // a product without a launch price: searching those would spend quota on
    // results that are all refused.
    const priceable = [...cameras.map((c) => ({ kind: "camera" as const, item: c })), ...lenses.map((l) => ({ kind: "lens" as const, item: l }))].filter(({ item }) => launchIn(item, currency));
    const products = ebayQueue(priceable, budget, day, now, viralSlugs());
    const bearer = await token(id, secret);
    const offers: Offer[] = [];
    const covered: string[] = [];
    for (const { kind, item } of products) {
      const params = new URLSearchParams({
        q: searchPhrase(item),
        // Camera glasses are outside Cameras & Photo on eBay: no category, the matcher decides.
        ...(kind === "camera" && (item as { type?: string }).type === "smart-glasses" ? {} : { category_ids: CATEGORY[kind] }),
        filter: `buyingOptions:{FIXED_PRICE},itemLocationCountry:${r.country},deliveryCountry:${r.country},price:[${priceFloor(item, currency)}..],priceCurrency:${currency}`,
        sort: "price",
        limit: "100",
      });
      const res = await fetch(`${SEARCH_URL}?${params}`, {
        headers: {
          Authorization: `Bearer ${bearer}`,
          "X-EBAY-C-MARKETPLACE-ID": r.ebay.marketplaceId,
          "X-EBAY-C-ENDUSERCTX": [
            ...(campaign ? [`affiliateCampaignId=${campaign}`] : []),
            ...(BUYER_ZIP[r.country] ? [`contextualLocation=${encodeURIComponent(`country=${r.country},zip=${BUYER_ZIP[r.country]}`)}`] : []),
          ].join(","),
        },
      });
      if (res.status === 429) {
        log(`${r.key}: rate limited after ${covered.length} searches`);
        break;
      }
      if (!res.ok) {
        log(`${r.key}: ${item.slug} ${res.status}`);
        continue;
      }
      covered.push(item.slug);
      const items = ((await res.json()) as { itemSummaries?: Summary[] }).itemSummaries ?? [];
      const kept = new Map<Condition, number>();
      for (const it of items) {
        const cond = condition(it.conditionId);
        // A price eBay converted from another currency breaks the never-convert rule.
        if (!cond || !it.price || it.price.currency !== currency || it.price.convertedFromCurrency) continue;
        if (Number(it.seller?.feedbackPercentage ?? 0) < MIN_SELLER_FEEDBACK) continue;
        const m = matchListing({ title: it.title }, index, kind);
        if (!m.product || m.product.slug !== item.slug || m.kit) continue;
        const itemPrice = toMinor(it.price.value);
        if (!plausiblePrice(m.product, cond, itemPrice / 100, currency, m.via)) continue;
        const postage = statedPostage(it, currency);
        if (postage == null) continue;
        const price = itemPrice + postage;
        const n = kept.get(cond) ?? 0;
        if (n >= KEEP_PER_CONDITION) continue;
        kept.set(cond, n + 1);
        offers.push({
          product: item.slug,
          kind,
          retailer: r.key,
          condition: cond,
          price,
          currency,
          url: it.itemAffiliateWebUrl || it.itemWebUrl,
          title: it.title,
          seller: it.seller?.username ?? null,
          inStock: true,
          kit: false,
          mount: m.mount,
          seenAt: now,
          sourceId: it.itemId,
          detail: postage ? "Price includes postage" : "Free postage",
        });
      }
      await sleep(200);
    }
    const note = `${covered.length}/${cameras.length + lenses.length} products searched`;
    // Every search failing is a broken run, not an empty one: say so, so check-sources alerts.
    if (products.length && !covered.length) return { status: "error", note: `no search succeeded (${note})` };
    return { status: "ok", offers, covered, note };
  },
});
