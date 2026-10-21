// Backfill price history from archived copies of our retailers' pages
// (DECISIONS.md "Price history backfill from archived store pages").
//
//   npx tsx scripts/backfill-history.ts [--markets au,us] [--stores teds,georges]
//        [--providers wayback,commoncrawl] [--from 2023-10-01] [--top 100]
//        [--max-fetch 400] [--gap 7] [--crawls 30] [--dry]
//
// Never fetches from a store. Two public archives, both of which crawl only
// where the store's robots.txt allows:
//   - the Internet Archive's Wayback Machine: its CDX API
//     (web.archive.org/cdx/search/cdx) lists the captures of a store's
//     Shopify /products.json (and ?page=N), /products/<handle>(.json|.js)
//     and product pages, and each capture's raw body is read from
//     web.archive.org/web/<ts>id_/<url>. At most one request a second, as the
//     Archive asks, backing off on 429/503 and stopping on repeated refusals
//     (it blocks an address for an hour when pushed).
//   - Common Crawl (data.commoncrawl.org, a public dataset on AWS): the
//     sorted CDX index of each monthly crawl is searched by HTTP range
//     requests on its cluster.idx, then each product page's WARC record is
//     range-read. Its pages carry the same schema.org Product/Offer data the
//     structured source reads live.
// Every snapshot goes through the live matching (matchListing, plausiblePrice,
// lib/price-history-backfill.ts) and lands, merged, in
// data/price-history-archive/<market>/<slug>.json.
//
// Keepa, camelcamelcamel, PriceSpy and the like are never scraped, and
// Amazon/eBay pages are never read (CLAUDE.md, "Prices and links").
// CDX answers and parsed snapshots are cached in BACKFILL_CACHE (default
// $TMPDIR/camcompare-backfill), so a rerun costs only what is new.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { readCameraFiles, readLensFiles } from "../src/lib/catalog/load";
import { buildIndex, matchListing, type CatalogIndex } from "../src/lib/matching";
import { isMarket, MARKET_CODES, MARKETS, type MarketCode } from "../src/lib/markets";
import { readOffersFile } from "../src/lib/offers";
import {
  ARCHIVE_DIR,
  listingsFromHtml,
  listingsFromShopify,
  mergePoints,
  parseCdx,
  readArchiveFile,
  snapshotKind,
  snapshotPrices,
  surtPrefix,
  tsDay,
  waybackRawUrl,
  waybackUrl,
  writeArchiveFile,
  type ArchivedListing,
  type ArchivePoint,
  type CdxRow,
} from "../src/lib/price-history-backfill";
import { RETAILERS, type Retailer } from "../src/lib/retailers";
import { slugText } from "../src/lib/sources/structured";

// ------------------------------------------------------------------ options
const args = process.argv.slice(2);
const opt = (k: string, d = "") => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d;
};
const flag = (k: string) => args.includes(`--${k}`);
const markets = (opt("markets") ? opt("markets").split(",").filter(isMarket) : [...MARKET_CODES]) as MarketCode[];
const onlyStores = opt("stores") ? new Set(opt("stores").split(",")) : null;
const providers = new Set(opt("providers", "wayback,commoncrawl").split(","));
const FROM = opt("from", new Date(Date.now() - 3 * 365 * 86400_000).toISOString().slice(0, 10));
const TOP = Number(opt("top", "100"));
const MAX_FETCH = Number(opt("max-fetch", "400")); // snapshot bodies per provider per store
const GAP_DAYS = Number(opt("gap", "7")); // read a URL at most once per this many days
const CRAWLS = Number(opt("crawls", "30"));
const DRY = flag("dry");
const CACHE = process.env.BACKFILL_CACHE || path.join(os.tmpdir(), "camcompare-backfill");
const UA = "Mozilla/5.0 (compatible; CamCompareBot/0.1; price-history backfill; +https://github.com/Specifxx/Camcompare)";

fs.mkdirSync(CACHE, { recursive: true });
const log = (s: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${s}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hash = (s: string) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 20);
function cached<T>(kind: string, key: string): T | undefined {
  const f = path.join(CACHE, kind, `${hash(key)}.json`);
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf8")) as T) : undefined;
}
function store(kind: string, key: string, v: unknown) {
  fs.mkdirSync(path.join(CACHE, kind), { recursive: true });
  fs.writeFileSync(path.join(CACHE, kind, `${hash(key)}.json`), JSON.stringify(v));
}

// ------------------------------------------------------------- polite fetch
class Blocked extends Error {}
type Gate = { name: string; minGapMs: number; last: number; failures: number; requests: number; blocked: string | null };
const gates: Record<string, Gate> = {
  wayback: { name: "web.archive.org", minGapMs: 1100, last: 0, failures: 0, requests: 0, blocked: null },
  cc: { name: "data.commoncrawl.org", minGapMs: 250, last: 0, failures: 0, requests: 0, blocked: null },
};

/** One request through a gate: spaced out, backing off on 429/5xx and resets, giving up after five in a row. */
async function politeFetch(g: Gate, url: string, headers: Record<string, string> = {}): Promise<Response | null> {
  if (g.blocked) throw new Blocked(g.blocked);
  for (let attempt = 0; attempt < 5; attempt++) {
    const wait = g.last + g.minGapMs - Date.now();
    if (wait > 0) await sleep(wait);
    g.last = Date.now();
    g.requests++;
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, ...headers }, signal: AbortSignal.timeout(90_000) });
      if (res.status === 429 || res.status === 503 || res.status >= 520) {
        g.failures++;
        const after = Number(res.headers.get("retry-after"));
        const back = Number.isFinite(after) && after > 0 ? Math.min(after, 300) * 1000 : 5000 * 2 ** attempt;
        log(`${g.name}: ${res.status}, waiting ${Math.round(back / 1000)} s`);
        await res.arrayBuffer().catch(() => null);
        await sleep(back);
        continue;
      }
      g.failures = 0;
      return res;
    } catch (e) {
      g.failures++;
      const back = 5000 * 2 ** attempt;
      log(`${g.name}: ${(e as Error).message}${(e as { cause?: Error }).cause ? ` (${(e as { cause?: Error }).cause!.message})` : ""}, waiting ${back / 1000} s`);
      await sleep(back);
    }
  }
  g.blocked = `${g.name} refused five requests in a row; stopping it for this run (try again in an hour)`;
  throw new Blocked(g.blocked);
}

// ----------------------------------------------------------------- catalog
const { cameras } = readCameraFiles();
const { lenses } = readLensFiles();
const index: CatalogIndex = buildIndex(cameras, lenses);

/** Most-offered products first: how many stores list them today across every market. */
const popularity = new Map<string, number>();
for (const m of MARKET_CODES) for (const o of readOffersFile(m).offers) popularity.set(o.product, (popularity.get(o.product) ?? 0) + 1);
const ranked = [...index.bySlug.keys()].sort((a, b) => (popularity.get(b) ?? 0) - (popularity.get(a) ?? 0) || a.localeCompare(b));
const wanted = new Set(TOP > 0 ? ranked.slice(0, TOP) : ranked);

/** The catalog product a URL's slug names, if it's one we're backfilling. */
function urlProduct(u: string): string | null {
  const kind = snapshotKind(u);
  if (!kind || kind === "products-json") return null;
  let text: string;
  try {
    text = slugText(u.replace(/\.(json|js)$/i, ""));
  } catch {
    return null;
  }
  const m = matchListing({ title: text.replace(/^products\s+/, "") }, index);
  return m.product && !m.kit && wanted.has(m.product.slug) ? m.product.slug : null;
}

// -------------------------------------------------------------- collection
type Found = { market: MarketCode; store: string; day: string; snapshotUrl: string; prices: Map<string, { new?: number; used?: number }> };
const found: Found[] = [];

function readBody(r: Retailer, url: string, body: string): ArchivedListing[] {
  const cur = MARKETS[r.market].currency;
  const kind = snapshotKind(url);
  if (kind === "page") return listingsFromHtml(body, url, r);
  if (kind) {
    try {
      return listingsFromShopify(JSON.parse(body), cur, r, kind === "product-js");
    } catch {
      return [];
    }
  }
  return [];
}

function record(r: Retailer, day: string, snapshotUrl: string, listings: ArchivedListing[]) {
  const prices = snapshotPrices(listings, index, MARKETS[r.market].currency, r);
  for (const k of [...prices.keys()]) if (!index.bySlug.has(k)) prices.delete(k);
  if (prices.size) found.push({ market: r.market, store: r.key, day, snapshotUrl, prices });
  return prices.size;
}

/** Captures to read: one per URL per GAP_DAYS, newest last; a repeated digest reuses the last read. */
function thin(rows: CdxRow[]): CdxRow[] {
  const last = new Map<string, string>();
  const out: CdxRow[] = [];
  for (const r of [...rows].sort((a, b) => a.ts.localeCompare(b.ts))) {
    const d = tsDay(r.ts);
    const prev = last.get(r.original);
    if (prev && Date.parse(d) - Date.parse(prev) < GAP_DAYS * 86400_000) continue;
    last.set(r.original, d);
    out.push(r);
  }
  return out;
}

// ------------------------------------------------------------------ Wayback
async function cdx(q: Record<string, string>): Promise<CdxRow[]> {
  const params = new URLSearchParams({ output: "json", fl: "timestamp,original,mimetype,statuscode,digest", filter: "statuscode:200", from: FROM.replace(/-/g, ""), ...q });
  const url = `https://web.archive.org/cdx/search/cdx?${params}`;
  const hit = cached<unknown>("cdx", url);
  if (hit) return parseCdx(hit);
  const res = await politeFetch(gates.wayback, url);
  if (!res || !res.ok) {
    log(`CDX ${res?.status ?? "failed"}: ${url}`);
    return [];
  }
  const text = await res.text();
  const json = text.trim() ? JSON.parse(text) : [];
  store("cdx", url, json);
  return parseCdx(json);
}

async function waybackStore(r: Retailer) {
  const host = new URL(r.shopify?.base ?? r.site).host;
  const rows: CdxRow[] = [];
  if (r.shopify) {
    // The whole catalogue, a page at a time: the richest captures there are.
    rows.push(...(await cdx({ url: `${host}/products.json`, matchType: "prefix", collapse: "timestamp:8", limit: "5000" })));
  }
  // Product URLs (Shopify /products/<handle>, .json, .js; any product page for a structured store).
  const prefix = r.shopify ? `${host}/products/` : `${host}/`;
  const urls = await cdx({ url: prefix, matchType: "prefix", collapse: "urlkey", fl: "timestamp,original,mimetype,statuscode,digest", limit: "100000" });
  const byProduct = new Map<string, string[]>();
  for (const u of urls) {
    const slug = urlProduct(u.original);
    if (slug) (byProduct.get(slug) ?? byProduct.set(slug, []).get(slug)!).push(u.original);
  }
  log(`wayback ${r.key}: ${rows.length} products.json captures, ${urls.length} archived URLs, ${byProduct.size} catalog products named`);
  const order = [...byProduct.keys()].sort((a, b) => ranked.indexOf(a) - ranked.indexOf(b));
  for (const slug of order) {
    // .json/.js first (cheap and exact), then pages; at most three URLs a product.
    const list = [...new Set(byProduct.get(slug)!)].sort((a, b) => Number(snapshotKind(a) === "page") - Number(snapshotKind(b) === "page")).slice(0, 3);
    for (const u of list) rows.push(...(await cdx({ url: u, collapse: "timestamp:8", limit: "2000" })));
  }
  let fetched = 0;
  let points = 0;
  const byDigest = new Map<string, ArchivedListing[]>();
  for (const row of thin(rows)) {
    if (!/json|javascript|html|text/i.test(row.mime)) continue;
    const key = `wb|${row.ts}|${row.original}`;
    let listings = cached<ArchivedListing[]>("snap", key) ?? (row.digest ? byDigest.get(row.digest) : undefined);
    if (!listings) {
      if (fetched >= MAX_FETCH) continue;
      const res = await politeFetch(gates.wayback, waybackRawUrl(row.ts, row.original));
      fetched++;
      if (!res || !res.ok) continue;
      listings = readBody(r, row.original, await res.text());
      store("snap", key, listings);
    }
    if (row.digest) byDigest.set(row.digest, listings);
    points += record(r, tsDay(row.ts), waybackUrl(row.ts, row.original), listings);
  }
  log(`wayback ${r.key}: ${fetched} snapshots read, ${points} product-days`);
}

// ------------------------------------------------------------- Common Crawl
const CC = "https://data.commoncrawl.org";

async function crawlIds(): Promise<string[]> {
  const hit = cached<string[]>("cc", "crawls");
  if (hit) return hit;
  const res = await politeFetch(gates.cc, `${CC}/crawl-data/index.html`);
  const ids = [...new Set([...((await res?.text()) ?? "").matchAll(/CC-MAIN-(\d{4})-(\d{2})/g)].map((m) => m[0]))].sort().reverse();
  store("cc", "crawls", ids);
  return ids;
}

/** A crawl's start date, from its id ("CC-MAIN-2025-33": week 33 of 2025). */
const crawlDay = (id: string) => {
  const [, y, w] = id.match(/(\d{4})-(\d{2})/)!;
  return new Date(Date.UTC(Number(y), 0, 1 + (Number(w) - 1) * 7)).toISOString().slice(0, 10);
};

type IdxLine = { key: string; file: string; offset: number; length: number };

async function rangeText(url: string, from: number, to: number): Promise<string> {
  const res = await politeFetch(gates.cc, url, { Range: `bytes=${from}-${to}` });
  return res && (res.status === 206 || res.ok) ? await res.text() : "";
}

/** The cluster.idx blocks that can hold keys starting with `prefix` (binary search by range reads). */
async function ccBlocks(crawl: string, prefix: string): Promise<IdxLine[]> {
  const ck = `${crawl}|${prefix}`;
  const hit = cached<IdxLine[]>("ccblocks", ck);
  if (hit) return hit;
  const url = `${CC}/cc-index/collections/${crawl}/indexes/cluster.idx`;
  const head = await politeFetch(gates.cc, url, { Range: "bytes=0-0" });
  const size = Number(head?.headers.get("content-range")?.split("/")[1] ?? 0);
  await head?.arrayBuffer().catch(() => null);
  if (!size) return [];
  const parse = (l: string): IdxLine | null => {
    const [key, file, off, len] = l.split("\t");
    return file ? { key: key.split(" ")[0], file, offset: Number(off), length: Number(len) } : null;
  };
  let lo = 0;
  let hi = size;
  while (hi - lo > 16384) {
    const mid = Math.floor((lo + hi) / 2);
    const t = await rangeText(url, mid, mid + 4095);
    const line = parse(t.slice(t.indexOf("\n") + 1).split("\n")[0]);
    if (!line) break;
    if (line.key < prefix) lo = mid;
    else hi = mid;
  }
  const lines = (await rangeText(url, lo, Math.min(size - 1, lo + 262143))).split("\n").slice(lo === 0 ? 0 : 1).map(parse).filter((x): x is IdxLine => x !== null);
  const out: IdxLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    const next = lines[i + 1];
    // Block i covers keys from its own up to the next block's first key.
    if (lines[i].key.startsWith(prefix) || (lines[i].key < prefix && (!next || next.key >= prefix))) out.push(lines[i]);
    if (lines[i].key > prefix && !lines[i].key.startsWith(prefix)) break;
  }
  store("ccblocks", ck, out);
  return out;
}

type CcRecord = { url: string; ts: string; status: string; mime: string; filename: string; offset: number; length: number; digest: string };

async function ccRecords(crawl: string, prefix: string): Promise<CcRecord[]> {
  const ck = `${crawl}|${prefix}`;
  const hit = cached<CcRecord[]>("ccrec", ck);
  if (hit) return hit;
  const out: CcRecord[] = [];
  for (const b of await ccBlocks(crawl, prefix)) {
    const res = await politeFetch(gates.cc, `${CC}/cc-index/collections/${crawl}/indexes/${b.file}`, { Range: `bytes=${b.offset}-${b.offset + b.length - 1}` });
    if (!res || !(res.status === 206 || res.ok)) continue;
    const text = gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8");
    for (const l of text.split("\n")) {
      if (!l.startsWith(prefix)) continue;
      const sp = l.indexOf(" {");
      try {
        const j = JSON.parse(l.slice(sp + 1)) as Record<string, string>;
        out.push({ url: j.url, ts: l.split(" ")[1], status: j.status, mime: j.mime ?? "", filename: j.filename, offset: Number(j.offset), length: Number(j.length), digest: j.digest ?? "" });
      } catch {}
    }
  }
  store("ccrec", ck, out);
  return out;
}

/** The HTTP body inside one WARC record (each record is its own gzip member). */
function warcBody(buf: Buffer): string {
  const rec = gunzipSync(buf);
  const s = rec.toString("latin1");
  const warcEnd = s.indexOf("\r\n\r\n");
  const httpEnd = s.indexOf("\r\n\r\n", warcEnd + 4);
  if (warcEnd < 0 || httpEnd < 0) return "";
  const headers = s.slice(warcEnd + 4, httpEnd).toLowerCase();
  let body = rec.subarray(httpEnd + 4);
  if (/\ncontent-encoding:\s*gzip/.test(headers) && body[0] === 0x1f && body[1] === 0x8b) body = gunzipSync(body);
  return body.toString("utf8");
}

async function commonCrawlStore(r: Retailer, crawls: string[]) {
  const host = new URL(r.shopify?.base ?? r.site).host;
  const prefix = surtPrefix(host, "/");
  let fetched = 0;
  let points = 0;
  let candidates = 0;
  // One capture per product URL per crawl, only URLs that name a product we
  // backfill; read most-offered products first, so a budget buys depth for
  // the products buyers look at rather than breadth over one recent crawl.
  const picks: (CcRecord & { slug: string })[] = [];
  for (const crawl of crawls) {
    let recs: CcRecord[];
    try {
      recs = await ccRecords(crawl, prefix);
    } catch (e) {
      if (e instanceof Blocked) throw e;
      log(`commoncrawl ${r.key} ${crawl}: ${(e as Error).message}`);
      continue;
    }
    const seen = new Set<string>();
    for (const x of recs) {
      if (x.status !== "200" || !/html|json|javascript/i.test(x.mime)) continue;
      const slug = urlProduct(x.url);
      const k = `${slug}|${x.url.replace(/[?#].*$/, "")}`;
      if (!slug || seen.has(k)) continue;
      seen.add(k);
      picks.push({ ...x, slug });
    }
  }
  candidates = picks.length;
  const rank = new Map(ranked.map((s, i) => [s, i]));
  picks.sort((a, b) => rank.get(a.slug)! - rank.get(b.slug)! || b.ts.localeCompare(a.ts));
  for (const x of picks) {
    const key = `cc|${x.filename}|${x.offset}`;
    let listings = cached<ArchivedListing[]>("snap", key);
    if (!listings) {
      if (fetched >= MAX_FETCH) continue;
      const res = await politeFetch(gates.cc, `${CC}/${x.filename}`, { Range: `bytes=${x.offset}-${x.offset + x.length - 1}` });
      fetched++;
      if (!res || !(res.status === 206 || res.ok)) continue;
      try {
        listings = readBody(r, x.url, warcBody(Buffer.from(await res.arrayBuffer())));
      } catch {
        listings = [];
      }
      store("snap", key, listings);
      if (fetched % 100 === 0) log(`commoncrawl ${r.key}: ${fetched} read`);
    }
    points += record(r, tsDay(x.ts), `${CC}/${x.filename}#offset=${x.offset}&length=${x.length}`, listings);
  }
  log(`commoncrawl ${r.key}: ${candidates} product captures over ${crawls.length} crawls, ${fetched} read, ${points} product-days`);
}

// --------------------------------------------------------------------- run
function backfillable(r: Retailer): boolean {
  if (!markets.includes(r.market) || (onlyStores && !onlyStores.has(r.key))) return false;
  if (r.amazon || r.ebay || r.source === "link-only") return false; // never Amazon or eBay pages
  if (r.shopify?.disabled) return false;
  if (r.structured?.slugless) return false; // URLs that don't name the product: nothing to pick by
  return Boolean(r.shopify || r.structured);
}

async function main() {
  const stores = RETAILERS.filter(backfillable).sort((a, b) => Number(Boolean(b.shopify)) - Number(Boolean(a.shopify)) || markets.indexOf(a.market) - markets.indexOf(b.market));
  log(`backfilling ${stores.length} stores in ${markets.join(",")} since ${FROM}, top ${TOP || "all"} products, providers ${[...providers].join(",")}; cache ${CACHE}`);
  let crawls: string[] = [];
  if (providers.has("commoncrawl")) {
    try {
      crawls = (await crawlIds()).filter((id) => crawlDay(id) >= FROM).slice(0, CRAWLS);
    } catch (e) {
      log(`commoncrawl: ${(e as Error).message}`);
    }
  }
  for (const r of stores) {
    if (providers.has("wayback") && !gates.wayback.blocked) {
      try {
        await waybackStore(r);
      } catch (e) {
        log(`wayback ${r.key}: ${(e as Error).message}`);
      }
    }
    if (providers.has("commoncrawl") && crawls.length && !gates.cc.blocked) {
      try {
        await commonCrawlStore(r, crawls);
      } catch (e) {
        log(`commoncrawl ${r.key}: ${(e as Error).message}`);
      }
    }
  }

  // Merge into data/price-history-archive/<market>/<slug>.json.
  const incoming = new Map<string, ArchivePoint[]>();
  for (const f of found)
    for (const [slug, p] of f.prices) {
      const k = `${f.market}|${slug}`;
      (incoming.get(k) ?? incoming.set(k, []).get(k)!).push({ day: f.day, ...(p.new ? { new: p.new } : {}), ...(p.used ? { used: p.used } : {}), store: f.store, source: "archive", snapshotUrl: f.snapshotUrl });
    }
  let files = 0;
  for (const [k, pts] of incoming) {
    const [m, slug] = k.split("|") as [MarketCode, string];
    const prev = readArchiveFile(m, slug);
    const points = mergePoints(prev?.points ?? [], pts);
    if (!DRY) writeArchiveFile({ slug, market: m, currency: MARKETS[m].currency, points });
    files++;
  }
  log(`${DRY ? "would write" : "wrote"} ${files} files; requests: wayback ${gates.wayback.requests}, commoncrawl ${gates.cc.requests}`);
  if (gates.wayback.blocked) log(`wayback: ${gates.wayback.blocked}`);
  if (gates.cc.blocked) log(`commoncrawl: ${gates.cc.blocked}`);
  coverage();
}

/** Products with at least five archived days, per market and in all. */
function coverage() {
  const all = new Set<string>();
  for (const m of MARKET_CODES) {
    const dir = path.join(ARCHIVE_DIR, m);
    if (!fs.existsSync(dir)) continue;
    let five = 0;
    let any = 0;
    let pts = 0;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
      const a = readArchiveFile(m, f.slice(0, -5));
      if (!a) continue;
      const days = new Set(a.points.map((p) => p.day)).size;
      any++;
      pts += a.points.length;
      if (days >= 5) {
        five++;
        all.add(a.slug);
      }
    }
    log(`coverage ${m}: ${any} products with archived points (${pts} points), ${five} with ≥ 5 archived days`);
  }
  log(`coverage: ${all.size} products with ≥ 5 archived days in at least one market`);
}

if (flag("coverage")) coverage();
else
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
