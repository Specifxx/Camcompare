import type { Camera, Lens } from "./catalog/schema";
import { brandName, displayName } from "./catalog";
import { MARKETS, marketPath, type MarketCode } from "./markets";
import { isAmazonOffer, type Offer } from "./offers";
import { retailer } from "./retailers";
import { abs, SITE_NAME } from "./site";
import { thumbSrc } from "./thumb";

/** `<` escaped so a title can never close the script tag. Null (no item) is `[]`, an empty but valid JSON-LD document. */
export const ldJson = (data: unknown) => ({ __html: JSON.stringify(data ?? []).replace(/</g, "\\u003c") });

export function breadcrumb(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.path) })),
  };
}

const ITEM_CONDITION: Record<Offer["condition"], string> = {
  new: "https://schema.org/NewCondition",
  "open-box": "https://schema.org/NewCondition",
  refurbished: "https://schema.org/RefurbishedCondition",
  used: "https://schema.org/UsedCondition",
};

/**
 * Product + AggregateOffer from the offers the page prices, in the market's
 * currency: in stock, not a kit, not Amazon (the same rule as `lowest`), so
 * "from" is the page's headline price. Null when there are none: a Product
 * without offers, review or rating is an invalid item to Google, and a price
 * nobody can buy at is the mismatch its rich-result checks flag.
 */
export function productLd(p: Camera | Lens, kind: "camera" | "lens", offers: Offer[], m: MarketCode) {
  const path = marketPath(m, `/${kind === "camera" ? "cameras" : "lenses"}/${p.slug}`);
  const body = offers.filter((o) => !o.kit && o.inStock && !isAmazonOffer(o));
  if (!body.length) return null;
  const prices = body.map((o) => o.price / 100);
  const validUntil = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${abs(path)}#product`,
    name: displayName(p, m),
    brand: { "@type": "Brand", name: brandName(p.brand) },
    image: abs(thumbSrc(p.slug)),
    ...(p.modelCodes[0] ? { mpn: p.modelCodes[0] } : {}),
    ...(p.gtins[0] ? { gtin: p.gtins[0] } : {}),
    category: kind === "camera" ? "Cameras" : "Camera Lenses",
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: MARKETS[m].currency,
      lowPrice: Math.min(...prices).toFixed(2),
      highPrice: Math.max(...prices).toFixed(2),
      offerCount: body.length,
      offers: body.slice(0, 10).map((o) => ({
        "@type": "Offer",
        price: (o.price / 100).toFixed(2),
        priceCurrency: o.currency,
        itemCondition: ITEM_CONDITION[o.condition],
        availability: "https://schema.org/InStock",
        seller: { "@type": "Organization", name: o.seller ?? retailer(o.retailer)?.name ?? o.retailer },
        priceValidUntil: validUntil,
      })),
    },
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: abs("/") },
  };
}

export function itemListLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.slice(0, 100).map((it, i) => ({ "@type": "ListItem", position: i + 1, url: abs(it.path), name: it.name })),
  };
}
