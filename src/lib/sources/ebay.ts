// eBay Browse API, the same integration RiftCompare runs (src/lib/ebay.ts
// there): client-credentials token, item_summary/search, and the EPN
// campaign in X-EBAY-C-ENDUSERCTX so eBay returns itemAffiliateWebUrl.
// One search per product per market, fixed-price only, items located in the
// market's country; every result still has to pass lib/matching.ts as THAT
// product. Quota: 5,000 Browse calls a day shared by every eBay market, so
// each market gets an equal share and walks the catalog in a daily rotation;
// products it skips keep their earlier offers (`covered`).
import { ebayCampaign } from "../affiliate";
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
};

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

export function dailyWindow<T>(items: T[], budget: number, day: number): T[] {
  if (budget >= items.length) return items;
  const start = (day * budget) % items.length;
  return [...items.slice(start), ...items.slice(0, start)].slice(0, budget);
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
    const budget = Math.floor(Number(process.env.EBAY_MAX_CALLS || 4600) / ebayMarkets);
    const day = Math.floor(Date.parse(now) / 86400_000);
    // eBay matches are title-only, and plausiblePrice trusts no title match for
    // a product without a launch price: searching those would spend quota on
    // results that are all refused.
    const priceable = [...cameras.map((c) => ({ kind: "camera" as const, item: c })), ...lenses.map((l) => ({ kind: "lens" as const, item: l }))].filter(({ item }) => launchIn(item, currency));
    const products = dailyWindow(priceable, budget, day);
    const bearer = await token(id, secret);
    const offers: Offer[] = [];
    const covered: string[] = [];
    for (const { kind, item } of products) {
      const params = new URLSearchParams({
        q: searchPhrase(item),
        category_ids: CATEGORY[kind],
        filter: `buyingOptions:{FIXED_PRICE},itemLocationCountry:${r.country},deliveryCountry:${r.country},price:[${priceFloor(item, currency)}..],priceCurrency:${currency}`,
        sort: "price",
        limit: "100",
      });
      const res = await fetch(`${SEARCH_URL}?${params}`, {
        headers: {
          Authorization: `Bearer ${bearer}`,
          "X-EBAY-C-MARKETPLACE-ID": r.ebay.marketplaceId,
          ...(campaign ? { "X-EBAY-C-ENDUSERCTX": `affiliateCampaignId=${campaign}` } : {}),
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
        const price = toMinor(it.price.value);
        if (!plausiblePrice(m.product, cond, price / 100, currency, m.via)) continue;
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
