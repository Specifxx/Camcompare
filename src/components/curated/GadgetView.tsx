// /drones and /smart-glasses (and /uk/drones…): every camera drone or pair
// of camera glasses in the catalog, grouped, with today's new and used
// prices in the market. Static, from the catalog and offers files, like
// /digicams; each product's own page is a normal camera page.
import type { Metadata } from "next";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { gadgetGroups, gadgets, GADGET_PAGES, pricedIn, type GadgetType } from "@/lib/curated";
import { ebayLink } from "@/lib/ebay-links";
import { MARKETS, marketPath, type MarketCode } from "@/lib/markets";
import { pageMeta } from "@/lib/seo";
import { summarizeCamera } from "@/lib/summary";
import EbayText from "@/components/ebay/EbayText";

const COPY: Record<GadgetType, { title: string; h1: string; description: (market: string) => string; intro: string; ebayQuery: string; ebayCategory: number | null | undefined }> = {
  drone: {
    title: "Drone prices: DJI Mini, Air, Mavic and more compared",
    h1: "Camera drones",
    description: (market) => `Every camera drone we track, from the DJI Mini and Flip to the Air 3S and Mavic 4 Pro, with today's new and used prices at the stores we track in ${market}, flight time, range and sensor size side by side.`,
    intro:
      "Camera drones from DJI and others, priced at the stores we track. The headline price is the drone with its standard remote (or the drone alone where that is how it is sold); Fly More and Creator combos with extra batteries are shown as bundles on each drone's page.",
    ebayQuery: "drone",
    ebayCategory: undefined,
  },
  "smart-glasses": {
    title: "Smart glasses prices: Ray-Ban Meta, Oakley Meta compared",
    h1: "Smart glasses",
    description: (market) => `Camera smart glasses compared: Ray-Ban Meta, Oakley Meta HSTN and Vanguard and Meta Ray-Ban Display, with today's prices at the stores we track in ${market}, camera, video and battery specs side by side.`,
    intro: "Glasses with a camera built into the frame, priced at the stores we track. Frame styles and lens tints of one model share a page: the price is the cheapest version in stock.",
    ebayQuery: "Ray-Ban Meta",
    ebayCategory: null,
  },
};

export function gadgetMetadata(t: GadgetType, m: MarketCode): Metadata {
  const c = COPY[t];
  return pageMeta({
    title: c.title,
    description: c.description(MARKETS[m].name),
    path: GADGET_PAGES[t].path,
    market: m,
    index: gadgets(t).length > 0 && pricedIn(gadgets(t), m),
    indexable: (x) => gadgets(t).length > 0 && pricedIn(gadgets(t), x),
  });
}

export default function GadgetView({ type: t, market: m }: { type: GadgetType; market: MarketCode }) {
  const c = COPY[t];
  const groups = gadgetGroups(t);
  const page = `${t}-${m}`;
  const used = ebayLink(m, { query: c.ebayQuery, condition: "used", category: c.ebayCategory }, page, `${t}-ebay-used`, `Used ${GADGET_PAGES[t].label.toLowerCase()} on eBay`);
  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-extrabold tracking-tight">{c.h1}</h1>
        <p className="mt-2 text-sm text-muted">
          {c.intro} Prices are today&apos;s cheapest in {MARKETS[m].name}, new and used. To line two up, open one and press Compare, or use the{" "}
          <Link href={marketPath(m, `/cameras?type=${t}`)} prefetch={false}>filterable list</Link>.
        </p>
        <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="On this page">
          {groups.length > 1 &&
            groups.map((g) => (
              <a key={g.id} href={`#${g.id}`}>
                {g.title} ({g.cameras.length})
              </a>
            ))}
          {used && (
            <EbayText link={used} product={t} placement={`${t}-ebay-used`}>
              {used.label}
            </EbayText>
          )}
        </nav>
      </header>
      {groups.length === 0 && <p className="text-sm text-muted">None listed yet: their photos and prices arrive with the next price update.</p>}
      {groups.map((g) => (
        <section key={g.id} id={g.id} aria-labelledby={`${g.id}-h`}>
          <h2 id={`${g.id}-h`} className="h-section">
            {g.title}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted">{g.blurb}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {g.cameras.map((x) => (
              <ProductCard key={x.slug} p={summarizeCamera(x, m)} market={m} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
