// eBay Browse API, the same integration RiftCompare runs (src/lib/ebay.ts
// there): client-credentials token, item_summary/search, and the EPN
// campaign in X-EBAY-C-ENDUSERCTX so eBay returns itemAffiliateWebUrl.
// One search per camera in category 31388 (Digital Cameras), fixed-price only;
// every result still has to pass lib/matching.ts as THAT camera.
// Quota: 5,000 Browse calls a day; one run is ~1 call per camera.
import { matchListing, plausiblePrice } from "../matching";
import type { Offer } from "../offers";
import type { Condition } from "../retailers";
import { toCents, type PriceSource } from "./types";

const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const DIGITAL_CAMERAS = "31388";

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
  price?: { value: string; currency: string };
  conditionId?: string;
  itemWebUrl: string;
  itemAffiliateWebUrl?: string;
  seller?: { username?: string; feedbackPercentage?: string; feedbackScore?: number };
  gtin?: string;
};

async function token(id: string, secret: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
  });
  if (!res.ok) throw new Error(`eBay token ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

/** Cheapest offers kept per camera and condition. */
const KEEP_PER_CONDITION = 3;
const MIN_SELLER_FEEDBACK = 98;

export const ebaySource: PriceSource = {
  retailer: "ebay",
  async run({ cameras, index, now, log }) {
    const id = process.env.EBAY_CLIENT_ID || "";
    const secret = process.env.EBAY_CLIENT_SECRET || "";
    if (!id || !secret) return { status: "skipped", note: "EBAY_CLIENT_ID / EBAY_CLIENT_SECRET not set" };
    const campaign = process.env.EBAY_AFFILIATE_CAMPAIGN || "";
    const bearer = await token(id, secret);
    const offers: Offer[] = [];
    let calls = 0;
    for (const camera of cameras) {
      const q = `${camera.brand === "om-system" ? "OM System" : camera.brand} ${camera.aliases[0]}`;
      const params = new URLSearchParams({
        q,
        category_ids: DIGITAL_CAMERAS,
        filter: "buyingOptions:{FIXED_PRICE},itemLocationCountry:US,deliveryCountry:US,priceCurrency:USD",
        sort: "price",
        limit: "100",
      });
      const res = await fetch(`${SEARCH_URL}?${params}`, {
        headers: {
          Authorization: `Bearer ${bearer}`,
          "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
          ...(campaign ? { "X-EBAY-C-ENDUSERCTX": `affiliateCampaignId=${campaign}` } : {}),
        },
      });
      calls++;
      if (res.status === 429) {
        log(`ebay: rate limited after ${calls} calls`);
        break;
      }
      if (!res.ok) {
        log(`ebay: ${camera.slug} ${res.status}`);
        continue;
      }
      const items = ((await res.json()) as { itemSummaries?: Summary[] }).itemSummaries ?? [];
      const kept = new Map<Condition, number>();
      for (const it of items) {
        const cond = condition(it.conditionId);
        if (!cond || !it.price || it.price.currency !== "USD") continue;
        if (Number(it.seller?.feedbackPercentage ?? 0) < MIN_SELLER_FEEDBACK) continue;
        const m = matchListing({ title: it.title, gtin: it.gtin }, index);
        if (!m.camera || m.camera.slug !== camera.slug || m.kit) continue;
        const priceCents = toCents(it.price.value);
        if (!plausiblePrice(camera, cond, priceCents / 100)) continue;
        const n = kept.get(cond) ?? 0;
        if (n >= KEEP_PER_CONDITION) continue;
        kept.set(cond, n + 1);
        offers.push({
          camera: camera.slug,
          retailer: "ebay",
          condition: cond,
          priceCents,
          currency: "USD",
          url: it.itemAffiliateWebUrl || it.itemWebUrl,
          title: it.title,
          seller: it.seller?.username ?? null,
          inStock: true,
          kit: false,
          seenAt: now,
          sourceId: it.itemId,
        });
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    return { status: "ok", offers, note: `${calls} Browse calls` };
  },
};
