import type { Metadata } from "next";
import Link from "next/link";
import AdSlot from "@/components/AdSlot";
import { AD_SLOTS } from "@/lib/ads";
import OffersTable from "@/components/OffersTable";
import PhotoCredit from "@/components/PhotoCredit";
import PriceBox from "@/components/PriceBox";
import OfficialLink from "@/components/OfficialLink";
import WorldPrices from "@/components/WorldPrices";
import PriceHistory from "@/components/PriceHistory";
import UsedValue from "@/components/UsedValue";
import ProductCard from "@/components/ProductCard";
import ProductThumb from "@/components/ProductThumb";
import SaveButton from "@/components/SaveButton";
import PriceAlert from "@/components/PriceAlert";
import Discussion from "@/components/community/Discussion";
import SpecHighlights from "@/components/SpecHighlights";
import SpecSheet from "@/components/SpecSheet";
import ReviewHub from "@/components/ReviewHub";
import { lensHighlights } from "@/lib/highlights";
import { brandName, camerasFor, credit, displayName, displayShortName, historyFor, isIndexedPair, launchPrice, lens as getLens, mount, offersFor, pairSlug, product, rivalsOf } from "@/lib/catalog";
import type { Lens } from "@/lib/catalog/schema";
import { longMonthYear, price } from "@/lib/format";
import { breadcrumb, ldJson, productLd } from "@/lib/jsonld";
import { MARKETS, marketPath, type MarketCode } from "@/lib/markets";
import { lowest } from "@/lib/offers";
import { pageMeta } from "@/lib/seo";
import { CATEGORY_LABEL, LENS_SPEC_GROUPS, apertureLabel, coverageLabel, equivalentLabel, focalLabel, lensCategories } from "@/lib/specs/lens";
import { summarizeCamera } from "@/lib/summary";
import { marketIndexable } from "./CameraView";

export function lensMetadata(slug: string, m: MarketCode): Metadata {
  const l = getLens(slug);
  if (!l) return {};
  const offers = offersFor(l.slug, m);
  const n = lowest(offers, "new");
  const u = lowest(offers, "used");
  const cur = MARKETS[m].currency;
  const name = displayName(l, m);
  const priceText = n ? ` New from ${price(n.price, cur)}${u ? `, used from ${price(u.price, cur)}` : ""}.` : u ? ` Used from ${price(u.price, cur)}.` : "";
  const mounts = l.mounts.map((x) => mount(x)?.name ?? x).join(", ");
  return pageMeta({
    title: `${name} price & specs`,
    description: `${name}: ${focalLabel(l)} ${apertureLabel(l)} ${coverageLabel(l.coverage).toLowerCase()} lens for ${mounts}.${priceText} Specs, compatible cameras and price history.`,
    path: `/lenses/${l.slug}`,
    market: m,
    image: `/products/${l.slug}.webp`,
    index: marketIndexable(l.slug)(m),
    indexable: marketIndexable(l.slug),
  });
}

// The rest of the key facts are tiles (SpecHighlights): here what a buyer calls it.
function KeySpecs({ l }: { l: Lens }) {
  const items = [`${coverageLabel(l.coverage)} lens`, ...lensCategories(l).map((c) => CATEGORY_LABEL[c])];
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <li key={t} className="chip">{t}</li>
      ))}
    </ul>
  );
}

export default function LensView({ slug, market: m }: { slug: string; market: MarketCode }) {
  const l = getLens(slug)!;
  const offers = offersFor(l.slug, m);
  // The price box shows Amazon's price live, with its time (TimedPrice).
  const n = lowest(offers, "new", true);
  const u = lowest(offers, "used", true);
  const self = product(l.slug)!;
  const rivals = rivalsOf(self);
  const family = [l.predecessor, l.successor].map((s) => (s ? product(s) : null)).filter((x): x is NonNullable<typeof x> => x !== null);
  const bodies = camerasFor(l);
  const name = displayName(l, m);
  const short = displayShortName(l, m);
  const page = `lens-${m}-${l.slug}`;
  const mountNames = l.mounts.map((x) => mount(x)).filter((x): x is NonNullable<typeof x> => x !== null);
  return (
    <article className="flex flex-col gap-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(productLd(l, "lens", offers, m))} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "Lenses", path: marketPath(m, "/lenses") }, { name: brandName(l.brand), path: marketPath(m, `/brands/${l.brand}`) }, { name, path: marketPath(m, `/lenses/${l.slug}`) }]))}
      />
      <div className="flex flex-col gap-6">
        <nav className="text-xs text-subtle" aria-label="Breadcrumb">
          <Link href={marketPath(m, "/lenses")}>Lenses</Link> / <Link href={marketPath(m, `/brands/${l.brand}`)}>{brandName(l.brand)}</Link> / <span>{short}</span>
        </nav>
        <header className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <figure>
            <ProductThumb slug={l.slug} alt={name} priority className="border border-line" />
            <PhotoCredit credit={credit(l.slug)} />
          </figure>
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{name}</h1>
              <p className="mt-1 text-sm text-muted">
                Lens for{" "}
                {mountNames.map((mt, i) => (
                  <span key={mt.slug}>
                    {i > 0 ? ", " : ""}
                    <Link href={marketPath(m, `/mounts/${mt.slug}`)}>{mt.name}</Link>
                  </span>
                ))}{" "}
                · Announced {longMonthYear(l.announced)}
                {l.status === "discontinued" ? " · Discontinued" : ""}
              </p>
              <p className="mt-1">
                <OfficialLink p={l} />
              </p>
            </div>
            <KeySpecs l={l} />
            <PriceBox newOffer={n} usedOffer={u} history={historyFor(l.slug, m)} launch={launchPrice(l, m)} market={m} />
            <div className="flex flex-wrap gap-2">
              <SaveButton slug={l.slug} kind="lens" market={m} seen={(lowest(offers, "new") ?? lowest(offers, "used"))?.price ?? null} cond={lowest(offers, "new") ? "new" : "used"} />
              <PriceAlert slug={l.slug} kind="lens" market={m} newPrice={lowest(offers, "new")?.price ?? null} usedPrice={lowest(offers, "used")?.price ?? null} />
            </div>
          </div>
        </header>
        <SpecHighlights items={lensHighlights(l)} />
      </div>

      <section id="prices">
        <h2 className="h-section mb-3">Where to buy the {short} in {MARKETS[m].name}</h2>
        <OffersTable product={l.slug} query={name} offers={offers} market={m} page={page} amazonAsin={l.amazonAsin} />
        {l.mounts.length > 1 && <p className="mt-2 text-xs text-subtle">Made in {l.mounts.length} mount versions. Check the version before you buy: each offer says which, when the retailer does.</p>}
      </section>

      <WorldPrices slug={l.slug} path={`/lenses/${l.slug}`} market={m} name={short} />

      <section id="history" className="scroll-mt-20">
        <h2 className="h-section mb-3">Price history</h2>
        <div className="card p-4">
          <PriceHistory points={historyFor(l.slug, m)} currency={MARKETS[m].currency} />
        </div>
      </section>

      <section>
        <h2 className="h-section mb-3">Used: what it should be worth</h2>
        <UsedValue history={historyFor(l.slug, m)} currency={MARKETS[m].currency} todayUsed={lowest(offers, "used")?.price ?? null} name={l.shortName} />
      </section>

      {(rivals.length > 0 || family.length > 0) && (
        <section>
          <h2 className="h-section mb-3">Compare the {short}</h2>
          <div className="flex flex-wrap gap-2">
            {[...family, ...rivals]
              .filter((x, i, arr) => arr.findIndex((y) => y.item.slug === x.item.slug) === i)
              .map((r) => (
                <Link key={r.item.slug} href={isIndexedPair(self, r) ? `/compare/${pairSlug(l, r.item)}` : marketPath(m, `/compare?c=${l.slug},${r.item.slug}`)} className="btn-ghost">
                  vs {displayName(r.item, m)}
                  {r.item.slug === l.predecessor ? <span className="text-xs font-normal text-subtle">(predecessor)</span> : r.item.slug === l.successor ? <span className="text-xs font-normal text-subtle">(successor)</span> : null}
                </Link>
              ))}
          </div>
        </section>
      )}

      {bodies.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="h-section">Cameras it fits</h2>
            {mountNames[0] && (
              <Link href={marketPath(m, `/cameras?mount=${l.mounts.join(",")}`)} className="shrink-0 text-sm">
                All {bodies.length} →
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {bodies.slice(0, 8).map((c) => (
              <ProductCard key={c.slug} p={summarizeCamera(c, m)} market={m} />
            ))}
          </div>
          {l.coverage === "aps-c" && <p className="mt-2 text-xs text-subtle">An APS-C lens also mounts on full-frame bodies of the same mount, where it crops the frame; those aren&apos;t listed.</p>}
        </section>
      )}

      <ReviewHub p={l} kind="lens" />

      <section>
        <h2 className="h-section mb-3">{short} specifications</h2>
        <SpecSheet item={l} groups={LENS_SPEC_GROUPS} />
      </section>

      <Discussion target={`product:${l.slug}`} name={short} />
      <AdSlot slot={AD_SLOTS.product} />
    </article>
  );
}
