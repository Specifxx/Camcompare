// Amazon Creators API (PA-API 5 was retired in 2026; calls to it now 403).
// OAuth client credentials against the regional token endpoint, then
// getItems for every catalog camera that has an `amazonAsin`, ten ASINs per
// call, asking only for OffersV2 listing fields.
// Docs: https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction
// NOTE: written from the published docs, not yet exercised against a live
// account — the ops check reports the first real run.
import { plausiblePrice } from "../matching";
import type { Offer } from "../offers";
import type { Condition } from "../retailers";
import type { PriceSource } from "./types";

const TOKEN_URL = process.env.AMAZON_CREATORS_TOKEN_URL || "https://api.amazon.com/auth/o2/token"; // NA credentials (version 3.1)
const API = "https://creatorsapi.amazon/catalog/v1/getItems";
const RESOURCES = [
  "itemInfo.title",
  "offersV2.listings.price",
  "offersV2.listings.condition",
  "offersV2.listings.availability",
  "offersV2.listings.merchantInfo",
  "offersV2.listings.isBuyBoxWinner",
];

type Listing = {
  price?: { money?: { amount?: number; currency?: string } };
  condition?: { value?: string };
  availability?: { type?: string };
  merchantInfo?: { name?: string };
  isBuyBoxWinner?: boolean;
};
type Item = { asin: string; detailPageURL?: string; itemInfo?: { title?: { displayValue?: string } }; offersV2?: { listings?: Listing[] } | null };

const cond = (v: string | undefined): Condition | null =>
  v === "New" ? "new" : v === "Used" ? "used" : v === "Refurbished" ? "refurbished" : v === "Collectible" ? null : null;

export const amazonSource: PriceSource = {
  retailer: "amazon",
  async run({ cameras, now, log }) {
    const id = process.env.AMAZON_CREATORS_CLIENT_ID || "";
    const secret = process.env.AMAZON_CREATORS_CLIENT_SECRET || "";
    const tag = process.env.AMAZON_ASSOCIATE_TAG || "";
    if (!id || !secret || !tag) return { status: "skipped", note: "AMAZON_CREATORS_CLIENT_ID / _SECRET / AMAZON_ASSOCIATE_TAG not set" };
    const withAsin = cameras.filter((c) => c.amazonAsin);
    if (!withAsin.length) return { status: "skipped", note: "no catalog camera has an amazonAsin yet" };

    const tok = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "client_credentials", client_id: id, client_secret: secret, scope: "creatorsapi::default" }),
    });
    if (!tok.ok) throw new Error(`Amazon token ${tok.status}`);
    const bearer = ((await tok.json()) as { access_token: string }).access_token;

    const offers: Offer[] = [];
    for (let i = 0; i < withAsin.length; i += 10) {
      const batch = withAsin.slice(i, i + 10);
      const res = await fetch(API, {
        method: "POST",
        headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json", "x-marketplace": "www.amazon.com" },
        body: JSON.stringify({ itemIds: batch.map((c) => c.amazonAsin), itemIdType: "ASIN", partnerTag: tag, marketplace: "www.amazon.com", resources: RESOURCES }),
      });
      if (!res.ok) {
        log(`amazon: batch ${i / 10} ${res.status} ${(await res.text()).slice(0, 200)}`);
        continue;
      }
      const body = (await res.json()) as { itemsResult?: { items?: Item[] } };
      for (const item of body.itemsResult?.items ?? []) {
        const camera = batch.find((c) => c.amazonAsin === item.asin);
        if (!camera) continue;
        for (const l of item.offersV2?.listings ?? []) {
          const c = cond(l.condition?.value);
          const amount = l.price?.money?.amount;
          if (!c || !amount || l.price?.money?.currency !== "USD") continue;
          if (!plausiblePrice(camera, c, amount)) continue;
          offers.push({
            camera: camera.slug,
            retailer: "amazon",
            condition: c,
            priceCents: Math.round(amount * 100),
            currency: "USD",
            url: item.detailPageURL || `https://www.amazon.com/dp/${item.asin}`,
            title: item.itemInfo?.title?.displayValue ?? camera.name,
            seller: l.merchantInfo?.name && l.merchantInfo.name !== "Amazon.com" ? l.merchantInfo.name : null,
            inStock: l.availability?.type === "IN_STOCK",
            kit: false,
            seenAt: now,
            sourceId: item.asin,
          });
        }
      }
      await new Promise((r) => setTimeout(r, 1100));
    }
    return { status: "ok", offers };
  },
};
