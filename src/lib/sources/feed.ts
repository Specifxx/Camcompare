// Affiliate-network product feeds: how CamCompare prices the camera dealers
// (B&H, Adorama, Best Buy, MPB, KEH). Every network — Impact, CJ, Awin,
// FlexOffers, Rakuten — hands approved publishers a daily product file with
// title, link, price, GTIN/UPC, MPN, condition and stock, in a Google
// Shopping-like layout. That file is the camera world's products.json: an
// approved, rate-limit-free way in, where scraping these dealers means
// bot walls (B&H and MPB return 403 to plain requests) and a ToS breach.
//
// Configure one retailer with FEED_URL_<KEY> (CSV, TSV or Google Shopping
// XML; `.gz` is unzipped). Rows are streamed, so a 400k-row dealer feed never
// sits in memory; only rows that match a catalog camera are kept.
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import readline from "node:readline";
import { matchListing, plausiblePrice } from "../matching";
import type { Offer } from "../offers";
import { retailer as getRetailer, type Condition } from "../retailers";
import { toCents, type PriceSource, type SourceContext } from "./types";

// Header spellings across Google Shopping, Impact, CJ and Awin feeds.
const FIELDS: Record<string, string[]> = {
  id: ["id", "sku", "unique merchant sku", "aw_product_id", "merchant_product_id", "catalog item id"],
  title: ["title", "product name", "product_name", "name"],
  link: ["link", "product url", "url", "aw_deep_link", "merchant_deep_link", "buy url"],
  price: ["price", "current price", "search_price", "retail price", "original price"],
  salePrice: ["sale_price", "sale price", "store_price"],
  availability: ["availability", "stock availability", "in_stock", "stock status"],
  condition: ["condition", "product condition"],
  gtin: ["gtin", "upc", "ean", "product_gtin", "upc or ean"],
  mpn: ["mpn", "manufacturer part number", "model_number", "mfr part number"],
};

export type FeedRow = Partial<Record<keyof typeof FIELDS, string>>;

export function headerMap(header: string[]): Map<number, keyof typeof FIELDS> {
  const m = new Map<number, keyof typeof FIELDS>();
  header.forEach((h, i) => {
    const key = h.trim().toLowerCase().replace(/^g:/, "");
    for (const [field, names] of Object.entries(FIELDS)) if (names.includes(key) && ![...m.values()].includes(field as keyof typeof FIELDS)) m.set(i, field as keyof typeof FIELDS);
  });
  return m;
}

/** One delimited line → cells; supports "quoted, cells" and "" escapes. */
export function splitDelimited(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') (cur += '"'), i++;
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"' && cur === "") q = true;
    else if (ch === delim) out.push(cur), (cur = "");
    else cur += ch;
  }
  out.push(cur);
  return out;
}

export function feedCondition(v: string | undefined): Condition | null {
  const s = (v || "new").toLowerCase();
  if (/refurb/.test(s)) return "refurbished";
  if (/open.?box|demo/.test(s)) return "open-box";
  if (/used|pre-?owned|excellent|good|like new|mint/.test(s)) return "used";
  if (/new/.test(s)) return "new";
  return null;
}

export const inStock = (v: string | undefined) => !v || /^(in.?stock|yes|true|1|available|limited)/i.test(v.trim());

async function* rows(url: string): AsyncGenerator<FeedRow> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`feed ${res.status}`);
  let stream = Readable.fromWeb(res.body as import("node:stream/web").ReadableStream);
  if (/\.gz($|\?)/.test(url) || res.headers.get("content-type")?.includes("gzip")) stream = stream.pipe(createGunzip());
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let header: Map<number, keyof typeof FIELDS> | null = null;
  let delim = ",";
  let xml = false;
  let item: FeedRow | null = null;
  let pending = "";
  for await (const raw of lines) {
    if (header === null && !xml) {
      if (/^\s*<\?xml|^\s*<rss|^\s*<feed/.test(raw)) {
        xml = true;
      } else {
        delim = raw.includes("\t") ? "\t" : raw.includes("|") && !raw.includes(",") ? "|" : ",";
        header = headerMap(splitDelimited(raw, delim));
        continue;
      }
    }
    if (xml) {
      // Google Shopping XML: <item> … <g:price>1999.00 USD</g:price> … </item>
      if (/<(item|entry)\b/.test(raw)) item = {};
      if (item) {
        for (const m of raw.matchAll(/<(?:g:)?([a-z_]+)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:g:)?\1>/g)) {
          const field = Object.entries(FIELDS).find(([, names]) => names.includes(m[1]))?.[0] as keyof typeof FIELDS | undefined;
          if (field && !item[field]) item[field] = decode(m[2]);
        }
      }
      if (/<\/(item|entry)>/.test(raw) && item) {
        yield item;
        item = null;
      }
      continue;
    }
    // A quoted cell can hold a newline: keep reading until quotes balance.
    pending = pending ? `${pending}\n${raw}` : raw;
    if ((pending.match(/"/g)?.length ?? 0) % 2) continue;
    const cells = splitDelimited(pending, delim);
    pending = "";
    const row: FeedRow = {};
    for (const [i, field] of header!) row[field] = cells[i]?.trim();
    yield row;
  }
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

/** Exported for tests: rows → offers, with every catalog and sanity rule applied. */
export function rowsToOffers(key: string, input: Iterable<FeedRow>, ctx: Pick<SourceContext, "index" | "now">): Offer[] {
  const out: Offer[] = [];
  for (const r of input) {
    const o = rowToOffer(key, r, ctx);
    if (o) out.push(o);
  }
  return out;
}

function rowToOffer(key: string, r: FeedRow, { index, now }: Pick<SourceContext, "index" | "now">): Offer | null {
  if (!r.title || !r.link) return null;
  const allowed = getRetailer(key)?.conditions ?? ["new"];
  const cond = feedCondition(r.condition);
  if (!cond || !allowed.includes(cond)) return null;
  const m = matchListing({ title: r.title, gtin: r.gtin, mpn: r.mpn }, index);
  if (!m.camera) return null;
  const sale = r.salePrice ? toCents(r.salePrice) : 0;
  const price = r.price ? toCents(r.price) : 0;
  const priceCents = sale > 0 && (!price || sale < price) ? sale : price;
  if (!priceCents || !plausiblePrice(m.camera, cond, priceCents / 100)) return null;
  return {
    camera: m.camera.slug,
    retailer: key,
    condition: cond,
    priceCents,
    currency: "USD",
    url: r.link,
    title: r.title,
    seller: null,
    inStock: inStock(r.availability),
    kit: m.kit,
    seenAt: now,
    sourceId: r.id ?? null,
  };
}

/** Per camera, condition and kit-ness, keep only the cheapest few rows: dealers list one camera under many SKUs. */
export function cheapestPerCamera(offers: Offer[], keep = 3): Offer[] {
  const groups = new Map<string, Offer[]>();
  for (const o of offers) {
    const k = `${o.camera}|${o.condition}|${o.kit}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(o);
  }
  return [...groups.values()].flatMap((g) => g.sort((a, b) => Number(b.inStock) - Number(a.inStock) || a.priceCents - b.priceCents).slice(0, keep));
}

export function feedSource(key: string): PriceSource {
  return {
    retailer: key,
    async run(ctx) {
      const url = process.env[`FEED_URL_${key.toUpperCase()}`] || "";
      if (!url) return { status: "skipped", note: `FEED_URL_${key.toUpperCase()} not set` };
      const offers: Offer[] = [];
      let seen = 0;
      for await (const r of rows(url)) {
        seen++;
        const o = rowToOffer(key, r, ctx);
        if (o) offers.push(o);
      }
      ctx.log(`${key}: ${seen} feed rows, ${offers.length} matched`);
      if (seen > 0 && offers.length === 0) return { status: "error", note: `${seen} rows, none matched the catalog: check the feed's columns` };
      return { status: "ok", offers: cheapestPerCamera(offers), note: `${seen} rows` };
    },
  };
}
