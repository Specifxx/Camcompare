// Per-market metadata. Each market's version of a page is its own URL with
// hreflang alternates between them. A market version is only worth indexing
// when it carries something market-specific (local prices), so product pages
// outside the US are noindex until that market has an offer, and are left
// out of the hreflang set and the sitemap until then.
import type { Metadata } from "next";
import { MARKET_CODES, MARKETS, marketPath, type MarketCode } from "./markets";
import { SITE_NAME } from "./site";

export function alternates(path: string, indexable: (m: MarketCode) => boolean = () => true): NonNullable<Metadata["alternates"]> {
  const languages: Record<string, string> = {};
  for (const m of MARKET_CODES) if (m === "us" || indexable(m)) for (const code of MARKETS[m].hreflang) languages[code] = marketPath(m, path);
  languages["x-default"] = path;
  return { languages };
}

/** Title suffix with the market for non-US pages: "… | UK prices". */
export const marketTitle = (title: string, m: MarketCode) => (m === "us" ? title : `${title} (${MARKETS[m].short} prices)`);

export function pageMeta(opts: {
  title: string;
  description: string;
  path: string; // market-less path, e.g. "/cameras/sony-a7-iv"
  market: MarketCode;
  image?: string;
  index?: boolean;
  indexable?: (m: MarketCode) => boolean;
}): Metadata {
  const url = marketPath(opts.market, opts.path);
  return {
    title: marketTitle(opts.title, opts.market),
    description: opts.description,
    alternates: { canonical: url, ...alternates(opts.path, opts.indexable) },
    openGraph: { title: opts.title, description: opts.description, url, siteName: SITE_NAME, type: "website", locale: MARKETS[opts.market].locale.replace("-", "_"), ...(opts.image ? { images: [opts.image] } : {}) },
    ...(opts.index === false ? { robots: { index: false, follow: true } } : {}),
  };
}
