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

export type RetailerSource = "amazon-creators" | "ebay-browse" | "bestbuy-api" | "feed" | "shopify" | "link-only";
export type Network =
  | "amazon"
  | "epn"
  | "impact"
  | "cj"
  | "awin"
  | "rakuten"
  | "partnerize"
  | "webgains"
  | "commission-factory"
  | "lazada"
  | "shopee"
  | "involve-asia"
  | "direct"
  | null;

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
  /**
   * Show a "Check price" row for this retailer on every product page that
   * has no price from it. Amazon always; otherwise the market's main camera
   * dealers. A row earns only once its affiliate link is configured.
   */
  checkRow?: boolean;
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

const dealer = (r: Omit<Retailer, "source" | "conditions" | "authorized"> & Partial<Pick<Retailer, "source" | "conditions" | "authorized">>): Retailer => ({
  source: "feed",
  conditions: ["new"],
  authorized: true,
  ...r,
});
const used = (r: Omit<Retailer, "source" | "conditions" | "authorized"> & Partial<Pick<Retailer, "source" | "conditions" | "authorized">>): Retailer => ({
  source: "feed",
  conditions: ["used"],
  authorized: false,
  ...r,
});
const shop = (base: string) => ({ source: "shopify" as const, shopify: { base } });

// Sources and programmes from the 2026-10-17 retailer research (docs/retailers.md).
export const RETAILERS: Retailer[] = [
  // ---- United States
  { ...amazon("us", "US", "www.amazon.com", "AMAZON_TAG_US"), checkRow: true },
  dealer({ key: "bh", name: "B&H Photo", market: "us", country: "US", site: "https://www.bhphotovideo.com", network: "direct", conditions: ["new", "used", "open-box", "refurbished"], checkRow: true, searchUrl: (q) => `https://www.bhphotovideo.com/c/search?q=${enc(q)}` }),
  dealer({ key: "adorama", name: "Adorama", market: "us", country: "US", site: "https://www.adorama.com", network: "impact", conditions: ["new", "used", "open-box", "refurbished"], checkRow: true, searchUrl: (q) => `https://www.adorama.com/l/?searchinfo=${enc(q)}` }),
  dealer({ key: "bestbuy", name: "Best Buy", market: "us", country: "US", site: "https://www.bestbuy.com", network: "impact", source: "bestbuy-api", conditions: ["new", "open-box", "refurbished"], searchUrl: (q) => `https://www.bestbuy.com/site/searchpage.jsp?st=${enc(q)}` }),
  dealer({ key: "walmart", name: "Walmart", market: "us", country: "US", site: "https://www.walmart.com", network: "impact", searchUrl: (q) => `https://www.walmart.com/search?q=${enc(q)}` }),
  dealer({ key: "abt", name: "Abt", market: "us", country: "US", site: "https://www.abt.com", network: "cj", searchUrl: (q) => `https://www.abt.com/resources/pages/search.php?keywords=${enc(q)}` }),
  dealer({ key: "moment", name: "Moment", market: "us", country: "US", site: "https://www.shopmoment.com", network: "impact", ...shop("https://www.shopmoment.com"), searchUrl: (q) => `https://www.shopmoment.com/search?q=${enc(q)}` }),
  dealer({ key: "focus-camera", name: "Focus Camera", market: "us", country: "US", site: "https://focuscamera.com", network: null, ...shop("https://focuscamera.com") }),
  dealer({ key: "beach-camera", name: "Beach Camera", market: "us", country: "US", site: "https://www.beachcamera.com", network: null, ...shop("https://www.beachcamera.com") }),
  dealer({ key: "camera-west", name: "Camera West", market: "us", country: "US", site: "https://camerawest.com", network: "direct", ...shop("https://camerawest.com"), conditions: ["new", "used"] }),
  used({ key: "mpb", name: "MPB", market: "us", country: "US", site: "https://www.mpb.com/en-us", network: "partnerize", checkRow: true, searchUrl: (q) => `https://www.mpb.com/en-us/search?q=${enc(q)}` }),
  used({ key: "keh", name: "KEH", market: "us", country: "US", site: "https://www.keh.com", network: "awin" }),
  ebay("us", "US", "www.ebay.com", "EBAY_US", "711-53200-19255-0", "0"),

  // ---- United Kingdom
  { ...amazon("uk", "GB", "www.amazon.co.uk", "AMAZON_TAG_UK"), checkRow: true },
  dealer({ key: "wex", name: "Wex Photo Video", market: "uk", country: "GB", site: "https://www.wexphotovideo.com", network: "impact", conditions: ["new", "used", "open-box"] }),
  dealer({ key: "park-cameras", name: "Park Cameras", market: "uk", country: "GB", site: "https://www.parkcameras.com", network: "rakuten", conditions: ["new", "used"] }),
  dealer({ key: "jessops", name: "Jessops", market: "uk", country: "GB", site: "https://www.jessops.com", network: "partnerize", checkRow: true, conditions: ["new", "used"], searchUrl: (q) => `https://www.jessops.com/search?q=${enc(q)}` }),
  dealer({ key: "clifton-cameras", name: "Clifton Cameras", market: "uk", country: "GB", site: "https://www.cliftoncameras.co.uk", network: "awin" }),
  dealer({ key: "cameraworld", name: "CameraWorld", market: "uk", country: "GB", site: "https://www.cameraworld.co.uk", network: "rakuten", conditions: ["new", "used"] }),
  dealer({ key: "lce", name: "London Camera Exchange", market: "uk", country: "GB", site: "https://www.lcegroup.co.uk", network: "webgains", conditions: ["new", "used"] }),
  dealer({ key: "currys", name: "Currys", market: "uk", country: "GB", site: "https://www.currys.co.uk", network: "awin" }),
  used({ key: "mpb-uk", name: "MPB", market: "uk", country: "GB", site: "https://www.mpb.com/en-uk", network: "partnerize", checkRow: true, searchUrl: (q) => `https://www.mpb.com/en-uk/search?q=${enc(q)}` }),
  used({ key: "harrison-cameras", name: "Harrison Cameras", market: "uk", country: "GB", site: "https://www.harrisoncameras.co.uk", network: null, ...shop("https://www.harrisoncameras.co.uk"), conditions: ["used", "new"] }),
  ebay("uk", "GB", "www.ebay.co.uk", "EBAY_GB", "710-53481-19255-0", "3"),

  // ---- Europe (euro)
  { ...amazon("eu", "DE", "www.amazon.de", "AMAZON_TAG_DE"), checkRow: true },
  dealer({ key: "calumet-de", name: "Calumet", market: "eu", country: "DE", site: "https://www.calumet.de", network: "awin", checkRow: true, searchUrl: (q) => `https://www.calumet.de/search?search=${enc(q)}` }),
  dealer({ key: "foto-erhardt", name: "Foto Erhardt", market: "eu", country: "DE", site: "https://www.foto-erhardt.de", network: "webgains", searchUrl: (q) => `https://www.foto-erhardt.de/advanced_search_result.php?keywords=${enc(q)}` }),
  dealer({ key: "cyberport", name: "Cyberport", market: "eu", country: "DE", site: "https://www.cyberport.de", network: "direct", searchUrl: (q) => `https://www.cyberport.de/tools/search?query=${enc(q)}` }),
  dealer({ key: "mediamarkt-de", name: "MediaMarkt", market: "eu", country: "DE", site: "https://www.mediamarkt.de", network: "direct", searchUrl: (q) => `https://www.mediamarkt.de/de/search.html?query=${enc(q)}` }),
  dealer({ key: "coolblue", name: "Coolblue", market: "eu", country: "NL", site: "https://www.coolblue.nl", network: "awin", searchUrl: (q) => `https://www.coolblue.nl/zoeken?query=${enc(q)}` }),
  used({ key: "mpb-eu", name: "MPB", market: "eu", country: "DE", site: "https://www.mpb.com/de-de", network: "partnerize", checkRow: true, searchUrl: (q) => `https://www.mpb.com/de-de/suche?q=${enc(q)}` }),
  ebay("eu", "DE", "www.ebay.de", "EBAY_DE", "707-53477-19255-0", "77"),

  // ---- Australia
  { ...amazon("au", "AU", "www.amazon.com.au", "AMAZON_TAG_AU"), checkRow: true },
  dealer({ key: "teds", name: "Ted's Cameras", market: "au", country: "AU", site: "https://www.teds.com.au", network: null, ...shop("https://www.teds.com.au"), searchUrl: (q) => `https://www.teds.com.au/search?q=${enc(q)}` }),
  dealer({ key: "digidirect", name: "Digidirect", market: "au", country: "AU", site: "https://www.digidirect.com.au", network: null, ...shop("https://www.digidirect.com.au"), searchUrl: (q) => `https://www.digidirect.com.au/search?q=${enc(q)}` }),
  dealer({ key: "georges", name: "Georges Cameras", market: "au", country: "AU", site: "https://www.georges.com.au", network: null, ...shop("https://www.georges.com.au") }),
  dealer({ key: "camera-electronic", name: "Camera Electronic", market: "au", country: "AU", site: "https://www.cameraelectronic.com.au", network: null, ...shop("https://www.cameraelectronic.com.au"), conditions: ["new", "used"] }),
  dealer({ key: "camera-house", name: "Camera House", market: "au", country: "AU", site: "https://www.camerahouse.com.au", network: "commission-factory", checkRow: true, searchUrl: (q) => `https://www.camerahouse.com.au/catalogsearch/result/?q=${enc(q)}` }),
  dealer({ key: "camerapro", name: "CameraPro", market: "au", country: "AU", site: "https://www.camerapro.com.au", network: "commission-factory", checkRow: true, searchUrl: (q) => `https://www.camerapro.com.au/catalogsearch/result/?q=${enc(q)}` }),
  dealer({ key: "jbhifi", name: "JB Hi-Fi", market: "au", country: "AU", site: "https://www.jbhifi.com.au", network: "partnerize", checkRow: true, searchUrl: (q) => `https://www.jbhifi.com.au/search?page=1&query=${enc(q)}` }),
  ebay("au", "AU", "www.ebay.com.au", "EBAY_AU", "705-53470-19255-0", "15"),

  // ---- Singapore (eBay Partner Network has no ebay.com.sg programme)
  { ...amazon("sg", "SG", "www.amazon.sg", "AMAZON_TAG_SG"), checkRow: true },
  { key: "lazada-sg", name: "Lazada", market: "sg", country: "SG", site: "https://www.lazada.sg", source: "link-only", conditions: ["new"], authorized: null, network: "lazada", checkRow: true, searchUrl: (q) => `https://www.lazada.sg/catalog/?q=${enc(q)}` },
  { key: "shopee-sg", name: "Shopee", market: "sg", country: "SG", site: "https://shopee.sg", source: "link-only", conditions: ["new"], authorized: null, network: "shopee", checkRow: true, searchUrl: (q) => `https://shopee.sg/search?keyword=${enc(q)}` },
  dealer({ key: "challenger-sg", name: "Challenger", market: "sg", country: "SG", site: "https://online.challenger.sg", network: null, ...shop("https://online.challenger.sg"), searchUrl: (q) => `https://online.challenger.sg/search?q=${enc(q)}` }),
  dealer({ key: "cathay-photo", name: "Cathay Photo", market: "sg", country: "SG", site: "https://www.cathayphoto.com.sg", network: null, source: "link-only", checkRow: true, searchUrl: (q) => `https://www.cathayphoto.com.sg/catalogsearch/results?q=${enc(q)}` }),
  dealer({ key: "canon-store-sg", name: "Canon Store", market: "sg", country: "SG", site: "https://shop.sg.canon", network: null, ...shop("https://shop.sg.canon") }),
  dealer({ key: "sony-store-sg", name: "Sony Store", market: "sg", country: "SG", site: "https://store.sony.com.sg", network: null, ...shop("https://store.sony.com.sg") }),
  dealer({ key: "leica-store-sg", name: "Leica Store", market: "sg", country: "SG", site: "https://leica-store.sg", network: null, ...shop("https://leica-store.sg") }),
  used({ key: "cash-converters-sg", name: "Cash Converters", market: "sg", country: "SG", site: "https://cashconverters.sg", network: null, ...shop("https://cashconverters.sg") }),
];

const BY_KEY = new Map(RETAILERS.map((r) => [r.key, r]));
export const retailer = (key: string) => BY_KEY.get(key);
export const retailersFor = (m: MarketCode) => RETAILERS.filter((r) => r.market === m);
export const ebayFor = (m: MarketCode) => RETAILERS.find((r) => r.market === m && r.ebay) ?? null;
