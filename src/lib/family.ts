// CamCompare's side of the Compare Empire network (lib/family-network.ts, DECISIONS.md "Sites that grow
// each other", 2026-11-02): the feed the price job publishes (data/family/family-feed.json: our best new
// prices under launch RRP per market, and every product page by name for Compare Empire's hand-offs) and
// Compare Empire's feed copied into data/family/family-cluster.json. Read at build, like all our data.
import fs from "node:fs";
import path from "node:path";
import { productPath, publishedCameras, publishedLenses } from "./catalog";
import { dealInputs } from "./deal-inputs";
import { homeDeals } from "./deals-home";
import { retailer } from "./retailers";
import { MARKETS, marketPath, type MarketCode } from "./markets";
import { abs } from "./site";
import { CLUSTER_FILE, pickTiles, sameProduct, validCluster, type FamilyFeed, type FamilyItem, type FamilyProduct, type FamilyRegion, type FamilyTile } from "./family-network";

export const FAMILY_DIR = path.join(process.cwd(), "data", "family");
const MARKET_CODES: MarketCode[] = ["us", "uk", "eu", "au", "sg"];
const REGION = (m: MarketCode) => m.toUpperCase() as FamilyRegion;

let cluster: FamilyFeed[] | null = null;
export function familyFeeds(now = Date.now()): FamilyFeed[] {
  if (cluster) return cluster;
  try {
    cluster = validCluster(JSON.parse(fs.readFileSync(path.join(FAMILY_DIR, CLUSTER_FILE), "utf8")), "cam", now);
  } catch {
    cluster = [];
  }
  return cluster;
}

/** Compare Empire's best tech deals for a market, its cameras first: up to three tiles. */
export function familyTiles(m: MarketCode): FamilyTile[] {
  return pickTiles(familyFeeds(), { self: "cam", cluster: "tech", kind: "deal", region: REGION(m), perSite: 3, max: 3, prefer: "cameras" });
}

/** The same camera on Compare Empire (more retailers, phones and laptops beside it): exact model only, else null. */
export function compareEmpireFor(name: string, aliases: readonly string[] = []): FamilyProduct | null {
  return sameProduct(name, familyFeeds().find((f) => f.site === "empire")?.products, aliases);
}

/** Our best new store prices under each market's launch RRP (the home page's deals, homeDeals). */
export function familyItems(): FamilyItem[] {
  const names = new Map([...publishedCameras(), ...publishedLenses()].map((p) => [p.slug, p.name]));
  const out: FamilyItem[] = [];
  for (const m of MARKET_CODES) {
    // Stores only: eBay sellers are never a store (Amazon is already left out by lowest()).
    const inputs = dealInputs(m).map((it) => ({ ...it, offers: it.offers.filter((o) => !retailer(o.retailer)?.ebay) }));
    for (const d of homeDeals(inputs, "new", { max: 12, minPct: 5 })) {
      const name = names.get(d.slug);
      if (!name) continue;
      out.push({
        kind: "deal",
        cluster: "tech",
        region: REGION(m),
        title: name,
        url: abs(marketPath(m, productPath({ kind: d.kind, slug: d.slug }))),
        image: abs(`/products/${d.slug}.webp`),
        cents: d.price,
        currency: MARKETS[m].currency,
        store: retailer(d.retailer)?.name ?? d.retailer,
        refCents: d.rrp,
        refLabel: "RRP",
        category: d.kind === "camera" ? "cameras" : "lenses",
      });
    }
  }
  return out;
}

export function familyLinks(): FamilyFeed["links"] {
  return Object.fromEntries(MARKET_CODES.map((m) => [REGION(m), { deals: abs(marketPath(m, "/deals")) }]));
}

/** Every camera page by its name and aliases (US pages: the root edition), for Compare Empire's hand-off. */
export function familyProducts(): FamilyProduct[] {
  return publishedCameras().flatMap((c) => [c.name, ...c.aliases].map((name) => ({ name, url: abs(productPath({ kind: "camera", slug: c.slug })) })));
}
