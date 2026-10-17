// Where CamCompare prices cameras and lenses, per market. Camera gear is not
// a Shopify market like trading cards: the volume sits with a handful of big
// dealers per country, each in an affiliate network that publishes a product
// feed (price, GTIN, MPN, condition, stock). So the default way in is that
// FEED; Amazon and eBay have official APIs; a Shopify store's public
// products.json is used only where the store runs Shopify and robots.txt
// allows it (RiftCompare's method). Never a scraper against a bot wall.
// See docs/retailers.md for each retailer's programme and how to switch it on.
//
// `authorized`: an authorized dealer in that market (local warranty). Grey
// imports on marketplaces are not, and the offers list says so.
// Client-safe: no Node imports.
import type { MarketCode } from "./markets";

export type Condition = "new" | "open-box" | "refurbished" | "used";
export const CONDITIONS: Condition[] = ["new", "open-box", "refurbished", "used"];
export const CONDITION_LABEL: Record<Condition, string> = { new: "New", "open-box": "Open box", refurbished: "Refurbished", used: "Used" };

export type RetailerSource = "amazon-creators" | "ebay-browse" | "feed" | "shopify" | "link-only";
export type Network = "amazon" | "epn" | "impact" | "cj" | "awin" | "rakuten" | "partnerize" | "flexoffers" | "involve-asia" | "accesstrade" | "direct" | null;

export type Retailer = {
  key: string;
  name: string;
  market: MarketCode;
  country: string; // ISO 3166 of the shop
  site: string;
  source: RetailerSource;
  conditions: Condition[];
  authorized: boolean | null; // null = marketplace, depends on the seller
  network: Network;
  /** Product search on the retailer's own site, used when there is no priced offer yet. */
  searchUrl?: (q: string) => string;
  amazon?: { marketplace: string; tagEnv: string };
  ebay?: { marketplaceId: string; rotationId: string; siteId: string };
  /** Public Shopify catalogue; `collections` limits the crawl to camera/lens collections. */
  shopify?: { base: string; collections?: string[] };
};

const enc = encodeURIComponent;
const amazon = (market: MarketCode, country: string, host: string, tagEnv: string): Retailer => ({
  key: market === "us" ? "amazon" : `amazon-${country.toLowerCase()}`,
  name: host.replace(/^www\./, "").replace(/^amazon/, "Amazon"),
  market,
  country,
  site: `https://${host}`,
  source: "amazon-creators",
  conditions: ["new", "used", "refurbished"],
  authorized: null,
  network: "amazon",
  searchUrl: (q) => `https://${host}/s?k=${enc(q)}`,
  amazon: { marketplace: host, tagEnv },
});
// eBay rotation ids per site (EPN), as RiftCompare's affiliate.ts uses them.
const ebay = (market: MarketCode, country: string, host: string, marketplaceId: string, rotationId: string, siteId: string): Retailer => ({
  key: market === "us" ? "ebay" : `ebay-${country.toLowerCase()}`,
  name: host.replace(/^www\./, "").replace(/^ebay/, "eBay"),
  market,
  country,
  site: `https://${host}`,
  source: "ebay-browse",
  conditions: ["new", "open-box", "refurbished", "used"],
  authorized: null,
  network: "epn",
  // 625 = Cameras & Photo: lenses and bodies, with the matcher refusing accessories.
  searchUrl: (q) => `https://${host}/sch/i.html?_nkw=${enc(q)}&_sacat=625`,
  ebay: { marketplaceId, rotationId, siteId },
});

export const RETAILERS: Retailer[] = [
  // ---- United States
  amazon("us", "US", "www.amazon.com", "AMAZON_TAG_US"),
  { key: "bh", name: "B&H Photo", market: "us", country: "US", site: "https://www.bhphotovideo.com", source: "feed", conditions: ["new", "used", "open-box", "refurbished"], authorized: true, network: "direct", searchUrl: (q) => `https://www.bhphotovideo.com/c/search?q=${enc(q)}` },
  { key: "adorama", name: "Adorama", market: "us", country: "US", site: "https://www.adorama.com", source: "feed", conditions: ["new", "used", "open-box", "refurbished"], authorized: true, network: "impact", searchUrl: (q) => `https://www.adorama.com/l/?searchinfo=${enc(q)}` },
  { key: "bestbuy", name: "Best Buy", market: "us", country: "US", site: "https://www.bestbuy.com", source: "feed", conditions: ["new", "open-box"], authorized: true, network: "impact", searchUrl: (q) => `https://www.bestbuy.com/site/searchpage.jsp?st=${enc(q)}` },
  ebay("us", "US", "www.ebay.com", "EBAY_US", "711-53200-19255-0", "0"),
  { key: "mpb", name: "MPB", market: "us", country: "US", site: "https://www.mpb.com/en-us", source: "feed", conditions: ["used"], authorized: false, network: "flexoffers", searchUrl: (q) => `https://www.mpb.com/en-us/search?q=${enc(q)}` },
  { key: "keh", name: "KEH", market: "us", country: "US", site: "https://www.keh.com", source: "feed", conditions: ["used"], authorized: false, network: null },

  // ---- United Kingdom
  amazon("uk", "GB", "www.amazon.co.uk", "AMAZON_TAG_UK"),
  ebay("uk", "GB", "www.ebay.co.uk", "EBAY_GB", "710-53481-19255-0", "3"),
  { key: "mpb-uk", name: "MPB", market: "uk", country: "GB", site: "https://www.mpb.com/en-uk", source: "feed", conditions: ["used"], authorized: false, network: "awin", searchUrl: (q) => `https://www.mpb.com/en-uk/search?q=${enc(q)}` },

  // ---- Europe (euro)
  amazon("eu", "DE", "www.amazon.de", "AMAZON_TAG_DE"),
  ebay("eu", "DE", "www.ebay.de", "EBAY_DE", "707-53477-19255-0", "77"),
  { key: "mpb-eu", name: "MPB", market: "eu", country: "DE", site: "https://www.mpb.com/de-de", source: "feed", conditions: ["used"], authorized: false, network: "awin", searchUrl: (q) => `https://www.mpb.com/de-de/search?q=${enc(q)}` },

  // ---- Australia
  amazon("au", "AU", "www.amazon.com.au", "AMAZON_TAG_AU"),
  ebay("au", "AU", "www.ebay.com.au", "EBAY_AU", "705-53470-19255-0", "15"),

  // ---- Singapore (no eBay Partner Network programme for ebay.com.sg)
  amazon("sg", "SG", "www.amazon.sg", "AMAZON_TAG_SG"),
];

const BY_KEY = new Map(RETAILERS.map((r) => [r.key, r]));
export const retailer = (key: string) => BY_KEY.get(key);
export const retailersFor = (m: MarketCode) => RETAILERS.filter((r) => r.market === m);
