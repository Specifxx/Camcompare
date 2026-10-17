// The US retailers CamCompare prices. Camera gear is not a Shopify market
// like trading cards: the volume sits with a handful of big dealers, each on
// an affiliate network that publishes a product feed (price, GTIN, MPN,
// condition, stock). So the default way in is that FEED, not a scraper —
// see lib/sources/feed.ts and docs/retailers.md.
//
// `authorized`: an authorized US dealer (manufacturer warranty). Grey-market
// sellers on eBay and Amazon marketplace are not, and the offers table says so.

export type Condition = "new" | "open-box" | "refurbished" | "used";
export const CONDITIONS: Condition[] = ["new", "open-box", "refurbished", "used"];
export const CONDITION_LABEL: Record<Condition, string> = { new: "New", "open-box": "Open box", refurbished: "Refurbished", used: "Used" };

export type RetailerSource = "amazon-creators" | "ebay-browse" | "feed" | "link-only";

export type Retailer = {
  key: string;
  name: string;
  site: string;
  source: RetailerSource;
  conditions: Condition[];
  authorized: boolean | null; // null = marketplace, depends on the seller
  /** Where the affiliate programme runs, for docs/retailers.md and the ops check. */
  network: "amazon" | "epn" | "impact" | "cj" | "awin" | "flexoffers" | "direct" | null;
  /** Product search on the retailer's own site, used when there is no priced offer yet. */
  searchUrl?: (q: string) => string;
};

const enc = encodeURIComponent;

export const RETAILERS: Retailer[] = [
  {
    key: "amazon",
    name: "Amazon",
    site: "https://www.amazon.com",
    source: "amazon-creators",
    conditions: ["new", "used", "refurbished"],
    authorized: null,
    network: "amazon",
    searchUrl: (q) => `https://www.amazon.com/s?k=${enc(q)}`,
  },
  {
    key: "bh",
    name: "B&H Photo",
    site: "https://www.bhphotovideo.com",
    source: "feed",
    conditions: ["new", "used", "open-box", "refurbished"],
    authorized: true,
    network: "direct",
    searchUrl: (q) => `https://www.bhphotovideo.com/c/search?q=${enc(q)}`,
  },
  {
    key: "adorama",
    name: "Adorama",
    site: "https://www.adorama.com",
    source: "feed",
    conditions: ["new", "used", "open-box", "refurbished"],
    authorized: true,
    network: "impact",
    searchUrl: (q) => `https://www.adorama.com/l/?searchinfo=${enc(q)}`,
  },
  {
    key: "bestbuy",
    name: "Best Buy",
    site: "https://www.bestbuy.com",
    source: "feed",
    conditions: ["new", "open-box"],
    authorized: true,
    network: "impact",
    searchUrl: (q) => `https://www.bestbuy.com/site/searchpage.jsp?st=${enc(q)}`,
  },
  {
    key: "ebay",
    name: "eBay",
    site: "https://www.ebay.com",
    source: "ebay-browse",
    conditions: ["new", "open-box", "refurbished", "used"],
    authorized: null,
    network: "epn",
    // 31388 = Cameras & Photo > Digital Cameras: keeps lenses and accessories out.
    searchUrl: (q) => `https://www.ebay.com/sch/i.html?_nkw=${enc(q)}&_sacat=31388`,
  },
  {
    key: "mpb",
    name: "MPB",
    site: "https://www.mpb.com/en-us",
    source: "feed",
    conditions: ["used"],
    authorized: false,
    network: "flexoffers",
    searchUrl: (q) => `https://www.mpb.com/en-us/search?q=${enc(q)}`,
  },
  {
    key: "keh",
    name: "KEH",
    site: "https://www.keh.com",
    source: "feed",
    conditions: ["used"],
    authorized: false,
    network: null,
  },
];

const BY_KEY = new Map(RETAILERS.map((r) => [r.key, r]));
export const retailer = (key: string) => BY_KEY.get(key);
