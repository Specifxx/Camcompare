// Affiliate-network product feeds: how CamCompare prices the camera dealers
// in every market (B&H, Adorama, Wex, Park Cameras, Calumet, Ted's, MPB…). Every network — Impact, CJ, Awin,
// FlexOffers, Rakuten — hands approved publishers a daily product file with
// title, link, price, GTIN/UPC, MPN, condition and stock, in a Google
// Shopping-like layout. That file is the camera world's products.json: an
// approved, rate-limit-free way in, where scraping these dealers means
// bot walls (B&H and MPB return 403 to plain requests) and a ToS breach.
//
// Configure one retailer with FEED_URL_<KEY> (CSV, TSV or Google Shopping
// XML; gzip is unzipped). Rows are streamed, so a 400k-row dealer feed never
// sits in memory; only rows that match a catalog camera are kept.
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import { matchListing, plausiblePrice } from "../matching";
import { MARKETS } from "../markets";
import type { Offer } from "../offers";
import { retailer as getRetailer, type Condition } from "../retailers";
import { toMinor, type PriceSource, type SourceContext } from "./types";

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
  currency: ["currency", "currency_code", "currencycode", "price currency"],
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

/** One delimited line → cells; supports "quoted, cells" and "" escapes. A quote opens only at the start of a cell. */
export function splitDelimited(line: string, delim: string): string[] {
  return scanDelimited(line, delim).cells;
}

/** splitDelimited, and whether the text ends inside a quoted cell (one that holds a newline). */
function scanDelimited(line: string, delim: string): { cells: string[]; open: boolean } {
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
  return { cells: out, open: q };
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

/**
 * The body as text pieces: the lines of a CSV or TSV, or for XML one piece
 * per <item>/<entry>, cut at its closing tag, so a feed written on a single
 * line still streams item by item.
 */
async function* pieces(stream: Readable): AsyncGenerator<{ xml: boolean; text: string }> {
  let buf = "";
  let xml: boolean | null = null;
  for await (const chunk of stream.setEncoding("utf8")) {
    buf += chunk;
    if (xml === null) {
      if (buf.trimStart().length < 5) continue;
      xml = /^\s*<(\?xml|rss|feed)/.test(buf);
    }
    let from = 0;
    for (const m of buf.matchAll(xml ? /<\/(?:item|entry)>/g : /\r?\n|\r(?!\n|$)/g)) {
      yield { xml, text: buf.slice(from, xml ? m.index + m[0].length : m.index) };
      from = m.index + m[0].length;
    }
    buf = buf.slice(from);
  }
  if (buf) yield { xml: xml ?? false, text: buf };
}

async function* rows(url: string): AsyncGenerator<FeedRow> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`feed ${res.status}`);
  yield* feedRows(res.body);
}

/** A feed's body → rows, whatever its format. Exported for tests. */
export async function* feedRows(input: ReadableStream<Uint8Array>): AsyncGenerator<FeedRow> {
  // Gzip is sniffed (magic bytes 1f 8b), not read from the URL or content
  // type: fetch has already undone a Content-Encoding: gzip (an S3 .gz
  // object often carries one), and networks serve gzipped feeds as
  // application/octet-stream from URLs without ".gz".
  const [probe, body] = input.tee();
  const reader = probe.getReader();
  const { value: head } = await reader.read();
  void reader.cancel();
  let stream = Readable.fromWeb(body as import("node:stream/web").ReadableStream);
  if (head?.[0] === 0x1f && head[1] === 0x8b) stream = stream.pipe(createGunzip());

  let header: Map<number, keyof typeof FIELDS> | null = null;
  let delim = ",";
  let pending = "";
  for await (const { xml, text: raw } of pieces(stream)) {
    if (xml) {
      // Google Shopping XML: <item> … <g:price>1999.00 USD</g:price> … </item>.
      // Fields are read after the opening tag, so the channel's own <title> never counts.
      const start = raw.search(/<(item|entry)\b/);
      if (start < 0) continue;
      const item: FeedRow = {};
      for (const m of raw.slice(raw.indexOf(">", start) + 1).matchAll(/<(?:g:)?([a-z_]+)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:g:)?\1>/g)) {
        const field = Object.entries(FIELDS).find(([, names]) => names.includes(m[1]))?.[0] as keyof typeof FIELDS | undefined;
        if (field && !item[field]) item[field] = decode(m[2]);
      }
      yield item;
      continue;
    }
    if (header === null) {
      delim = raw.includes("\t") ? "\t" : raw.includes("|") && !raw.includes(",") ? "|" : ",";
      header = headerMap(splitDelimited(raw, delim));
      continue;
    }
    // A quoted cell can hold a newline: keep reading while one is open. Quotes
    // are read as splitDelimited reads them, so an inch mark in a cell
    // (`Ninja V 5" Monitor`) doesn't swallow the rows after it.
    pending = pending ? `${pending}\n${raw}` : raw;
    const { cells, open } = scanDelimited(pending, delim);
    if (open) continue;
    pending = "";
    const row: FeedRow = {};
    for (const [i, field] of header) row[field] = cells[i]?.trim();
    yield row;
  }
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

/** "1299.00 GBP" → "GBP" (any ISO code, so "CAD" is caught too); null when the price names no currency. */
export function priceCurrency(v: string | undefined): string | null {
  if (!v) return null;
  const m = v.match(/(?:^|[\d\s])([A-Z]{3})\b/) ?? v.match(/\b([A-Z]{3})\s*[\d]/);
  if (m) return m[1];
  if (v.includes("£")) return "GBP";
  if (v.includes("€")) return "EUR";
  return null;
}

type RowCtx = Pick<SourceContext, "index" | "now" | "market">;

/** Exported for tests: rows → offers, with every catalog and sanity rule applied. */
export function rowsToOffers(key: string, input: Iterable<FeedRow>, ctx: RowCtx): Offer[] {
  const out: Offer[] = [];
  for (const r of input) {
    const o = rowToOffer(key, r, ctx);
    if (o) out.push(o);
  }
  return out;
}

/** A product link we can put behind a button: absolute http(s) only. */
function safeLink(v: string): string | null {
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function rowToOffer(key: string, r: FeedRow, { index, now, market }: RowCtx): Offer | null {
  const link = r.link ? safeLink(r.link) : null;
  if (!r.title || !link) return null;
  const allowed = getRetailer(key)?.conditions ?? ["new"];
  const cond = feedCondition(r.condition);
  if (!cond || !allowed.includes(cond)) return null;
  // A feed priced in another currency is refused, never converted
  // (RiftCompare's offer-currency rule, after a CAD-as-USD store).
  const currency = MARKETS[market].currency;
  // Awin, CJ and Impact name it in a column; Google Shopping in the price.
  const named = r.currency?.trim().toUpperCase() || priceCurrency(r.salePrice || r.price);
  if (named && named !== currency) return null;
  const m = matchListing({ title: r.title, gtin: r.gtin, mpn: r.mpn }, index);
  if (!m.product) return null;
  const sale = r.salePrice ? toMinor(r.salePrice) : 0;
  const full = r.price ? toMinor(r.price) : 0;
  const price = sale > 0 && (!full || sale < full) ? sale : full;
  if (!price || !plausiblePrice(m.product, cond, price / 100, currency, m.via)) return null;
  return {
    product: m.product.slug,
    kind: m.kind,
    retailer: key,
    condition: cond,
    price,
    currency,
    url: link,
    title: r.title,
    seller: null,
    inStock: inStock(r.availability),
    kit: m.kit,
    mount: m.mount,
    seenAt: now,
    sourceId: r.id ?? null,
  };
}

/** Per product, condition, kit-ness and mount, keep only the cheapest few rows: dealers list one product under many SKUs. */
export function cheapestPerProduct(offers: Offer[], keep = 3): Offer[] {
  const groups = new Map<string, Offer[]>();
  for (const o of offers) {
    const k = `${o.product}|${o.condition}|${o.kit}|${o.mount}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(o);
  }
  return [...groups.values()].flatMap((g) => g.sort((a, b) => Number(b.inStock) - Number(a.inStock) || a.price - b.price).slice(0, keep));
}

export function feedSource(key: string): PriceSource {
  return {
    retailer: key,
    async run(ctx) {
      const envName = `FEED_URL_${key.toUpperCase().replace(/-/g, "_")}`;
      const url = process.env[envName] || "";
      if (!url) return { status: "skipped", note: `${envName} not set` };
      const offers: Offer[] = [];
      let seen = 0;
      for await (const r of rows(url)) {
        seen++;
        const o = rowToOffer(key, r, ctx);
        if (o) offers.push(o);
      }
      ctx.log(`${key}: ${seen} feed rows, ${offers.length} matched`);
      if (seen > 0 && offers.length === 0) return { status: "error", note: `${seen} rows, none matched the catalog: check the feed's columns` };
      return { status: "ok", offers: cheapestPerProduct(offers), note: `${seen} rows` };
    },
  };
}
