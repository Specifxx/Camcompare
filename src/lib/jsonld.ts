import type { Camera } from "./catalog/schema";
import { brandName } from "./catalog";
import type { Offer } from "./offers";
import { retailer } from "./retailers";
import { abs, SITE_NAME } from "./site";
import { thumbSrc } from "./thumb";

/** `<` escaped so a title can never close the script tag. */
export const ldJson = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, "\\u003c") });

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
 * Product + AggregateOffer from the offers actually on the page. With no
 * offers there is no `offers` key at all: a Product claiming a price we
 * don't show is the mismatch Google's rich-result checks flag.
 */
export function productLd(c: Camera, offers: Offer[]) {
  const body = offers.filter((o) => !o.kit);
  const prices = body.map((o) => o.priceCents / 100);
  const validUntil = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${abs(`/cameras/${c.slug}`)}#product`,
    name: c.name,
    brand: { "@type": "Brand", name: brandName(c.brand) },
    image: abs(thumbSrc(c.slug)),
    ...(c.modelCodes[0] ? { mpn: c.modelCodes[0] } : {}),
    ...(c.gtins[0] ? { gtin: c.gtins[0] } : {}),
    category: "Digital Cameras",
    ...(body.length
      ? {
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "USD",
            lowPrice: Math.min(...prices).toFixed(2),
            highPrice: Math.max(...prices).toFixed(2),
            offerCount: body.length,
            offers: body.slice(0, 10).map((o) => ({
              "@type": "Offer",
              price: (o.priceCents / 100).toFixed(2),
              priceCurrency: "USD",
              itemCondition: ITEM_CONDITION[o.condition],
              availability: o.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              seller: { "@type": "Organization", name: o.seller ?? retailer(o.retailer)?.name ?? o.retailer },
              priceValidUntil: validUntil,
            })),
          },
        }
      : {}),
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: abs("/") },
  };
}
