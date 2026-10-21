// Between price imports: re-reads stock for ONLY the products someone has a
// confirmed restock or preorder alert on, and emails on a transition
// (docs/premium-plan.md, "Instant-ish checks"). Off unless WATCH_CHECKS=1.
//
// What it reads, all of it already allowed by the price import's own rules:
//  - Shopify stores: the one product's /products/<handle>.js (its variants'
//    `available`), from the offer URL the import stored;
//  - structured-data stores: the offer's own product page, its schema.org
//    availability (sources/structured.ts pageListings).
// robots.txt is checked per store; a 401/403/429 or a bot challenge stops
// that store for the run (never worked around). Feed stores, eBay and Amazon
// are left to the 3-hourly import: a feed is a whole file, the other two are
// marketplaces and an API whose prices may not be stored.
//
// It writes no file and commits nothing, so it deploys nothing: the fresher
// stock is used for the emails and thrown away. One SELECT a run (none of the
// other work happens without a watched product); one UPDATE per change.
//   WATCH_MAX_REQUESTS  pages a run (default 60)    WATCH_PER_STORE  per store (default 12)
import { runAlerts } from "../src/lib/alert-run";
import { alertsConfigured, watchedAlerts } from "../src/lib/alerts";
import { logSafe } from "../src/lib/feedback";
import type { MarketCode } from "../src/lib/markets";
import { readOffersFile, type Offer } from "../src/lib/offers";
import { readReleases } from "../src/lib/releases/data";
import { isStoreOffer } from "../src/lib/releases/stock";
import { retailer } from "../src/lib/retailers";
import { blockedReason, pageListings } from "../src/lib/sources/structured";
import { robotsAllows } from "../src/lib/sources/shopify";
import { sleep } from "../src/lib/sources/types";

const UA = "Mozilla/5.0 (compatible; CamCompareBot/0.1; +https://github.com/Specifxx/Camcompare)";
const MAX_REQUESTS = Number(process.env.WATCH_MAX_REQUESTS) || 60;
const PER_STORE = Number(process.env.WATCH_PER_STORE) || 12;
const DELAY_MS = 1500;
const MAX_EMAILS = Number(process.env.ALERTS_MAX_EMAILS) || 30;

type Fresh = { inStock: boolean } | null;

const robots = new Map<string, string | null>();
const stopped = new Map<string, string>();
const perStore = new Map<string, number>();
let requests = 0;

async function robotsFor(origin: string): Promise<string | null> {
  if (!robots.has(origin)) {
    const r = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15_000) }).catch(() => null);
    robots.set(origin, !r || r.status >= 500 ? null : r.ok ? await r.text() : "");
  }
  return robots.get(origin) ?? null;
}

async function politeFetch(url: string, accept: string): Promise<{ status: number; headers: Headers; text: string } | null> {
  const u = new URL(url);
  if (stopped.has(u.origin) || requests >= MAX_REQUESTS || (perStore.get(u.origin) ?? 0) >= PER_STORE) return null;
  const rules = await robotsFor(u.origin);
  if (rules === null || !robotsAllows(rules, u.pathname + u.search)) return null;
  requests++;
  perStore.set(u.origin, (perStore.get(u.origin) ?? 0) + 1);
  const r = await fetch(url, { headers: { "User-Agent": UA, From: "camcompare-bot@users.noreply.github.com", Accept: accept }, signal: AbortSignal.timeout(20_000) });
  const text = await r.text();
  const blocked = blockedReason(r.status, r.headers, text);
  if (blocked) {
    stopped.set(u.origin, blocked);
    return null;
  }
  await sleep(DELAY_MS);
  return { status: r.status, headers: r.headers, text };
}

/** Today's stock for one stored offer, or null when it can't (or may not) be re-read. */
async function recheck(o: Offer): Promise<Fresh> {
  const r = retailer(o.retailer);
  if (!r) return null;
  const u = new URL(o.url);
  if (r.source === "shopify" && r.shopify && !r.shopify.disabled) {
    const handle = u.pathname.match(/\/products\/([^/?#]+)/)?.[1];
    if (!handle) return null;
    const res = await politeFetch(`${u.origin}/products/${handle}.js`, "application/json");
    if (!res || res.status !== 200) return null;
    const p = JSON.parse(res.text) as { variants?: { id: number; available: boolean }[] };
    const want = u.searchParams.get("variant") ?? o.sourceId;
    const v = p.variants?.find((x) => String(x.id) === want) ?? (p.variants?.length === 1 ? p.variants[0] : undefined);
    return v ? { inStock: Boolean(v.available) } : null;
  }
  if (r.structured && !r.disabled) {
    const res = await politeFetch(o.url, "text/html");
    if (!res || res.status !== 200) return null;
    const listings = pageListings(res.text);
    if (!listings.length) return null;
    return { inStock: listings.some((l) => l.inStock) };
  }
  return null;
}

async function main() {
  if (process.env.WATCH_CHECKS !== "1") {
    console.log("check-watched: WATCH_CHECKS is not 1, skipping");
    return;
  }
  if (!alertsConfigured()) {
    console.log("check-watched: DATABASE_URL or RESEND_API_KEY not set, skipping");
    return;
  }
  const alerts = await watchedAlerts();
  if (!alerts.length) {
    console.log("check-watched: no restock or preorder alerts");
    return;
  }
  const releases = readReleases().releases;
  const byRelease = new Map(releases.map((r) => [r.id, r.products]));

  // The products to look at, per market.
  const wanted = new Map<MarketCode, Set<string>>();
  for (const a of alerts) {
    const set = wanted.get(a.market) ?? wanted.set(a.market, new Set()).get(a.market)!;
    for (const s of a.kind === "release" ? byRelease.get(a.product) ?? [] : [a.product]) set.add(s);
  }

  // The committed offers for them, with each store listing re-read where allowed.
  const offers = new Map<string, Offer[]>();
  let rechecked = 0;
  let changed = 0;
  for (const [m, slugs] of wanted) {
    const file = readOffersFile(m).offers.filter((o) => slugs.has(o.product));
    for (const slug of slugs) offers.set(`${m}:${slug}`, []);
    for (const o of file) {
      let cur = o;
      if (isStoreOffer(o) && o.condition === "new") {
        const f = await recheck(o).catch(() => null);
        if (f) {
          rechecked++;
          if (f.inStock !== o.inStock || (f.inStock && o.availability && o.availability !== "in_stock" && o.availability !== "low_stock")) changed++;
          // A fresh "in stock" wins over a stored preorder/backorder flag; a fresh "out" keeps a preorder flag (still orderable).
          cur = { ...o, inStock: f.inStock, availability: f.inStock ? "in_stock" : o.availability === "preorder" ? "preorder" : "out_of_stock" };
        }
      }
      offers.get(`${m}:${o.product}`)!.push(cur);
    }
  }

  const r = await runAlerts({ alerts, offersOf: (m, s) => offers.get(`${m}:${s}`) ?? [], releases, maxEmails: MAX_EMAILS, log: (s) => console.error(`check-watched: ${s}`) });
  const products = [...wanted.values()].reduce((n, s) => n + s.size, 0);
  console.log(`check-watched: ${alerts.length} alerts on ${products} products, ${requests} pages read, ${rechecked} listings re-checked, ${changed} changed, ${r.sent} emails, ${r.failed} failed`);
  for (const [origin, why] of stopped) console.log(`check-watched: stopped ${origin}: ${why}`);
  if (r.failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(`check-watched: ${logSafe(e)}`);
  process.exit(1);
});
