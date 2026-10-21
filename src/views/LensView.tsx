import type { Metadata } from "next";
import Link from "next/link";
import AdSlot from "@/components/AdSlot";
import { AD_SLOTS } from "@/lib/ads";
import OffersTable from "@/components/OffersTable";
import PriceBox from "@/components/PriceBox";
import OfficialLink from "@/components/OfficialLink";
import WorldPrices from "@/components/WorldPrices";
import PriceHistory from "@/components/PriceHistory";
import UsedValue from "@/components/UsedValue";
import ProductCard from "@/components/ProductCard";
import SaveButton from "@/components/SaveButton";
import PriceAlert from "@/components/PriceAlert";
import SpecHighlights from "@/components/SpecHighlights";
import SpecSheet from "@/components/SpecSheet";
import Gallery from "@/components/product/Gallery";
import MoreOptions from "@/components/product/MoreOptions";
import PageNav from "@/components/product/PageNav";
import ProductDiscussions from "@/components/product/ProductDiscussions";
import ProductReviews from "@/components/product/ProductReviews";
import ProductVideos from "@/components/product/ProductVideos";
import ReviewStars from "@/components/product/ReviewStars";
import ThingsToKnow from "@/components/product/ThingsToKnow";
import { galleryFor } from "@/lib/gallery";
import { discussionLinks, videoLinks } from "@/lib/media-links";
import { headline, priceSentence } from "@/lib/price-rules";
import { lensThings } from "@/lib/things-to-know";
import { usedValue } from "@/lib/value";
import { lensHighlights } from "@/lib/highlights";
import { brandName, camerasFor, displayName, displayShortName, historyFor, isIndexedPair, launchPrice, lens as getLens, mount, offersFor, pairSlug, product, rivalsOf } from "@/lib/catalog";
import type { Lens } from "@/lib/catalog/schema";
import { longMonthYear } from "@/lib/format";
import { breadcrumb, ldJson, productLd } from "@/lib/jsonld";
import { MARKETS, marketPath, type MarketCode } from "@/lib/markets";
import { pageMeta } from "@/lib/seo";
import { CATEGORY_LABEL, LENS_SPEC_GROUPS, apertureLabel, coverageLabel, equivalentLabel, focalLabel, lensCategories } from "@/lib/specs/lens";
import { summarizeCamera } from "@/lib/summary";
import { marketIndexable } from "./CameraView";

export function lensMetadata(slug: string, m: MarketCode): Metadata {
  const l = getLens(slug);
  if (!l) return {};
  const offers = offersFor(l.slug, m);
  const cur = MARKETS[m].currency;
  const name = displayName(l, m);
  // The same headline rule as the page (lib/price-rules.ts).
  const priceText = priceSentence(offers, cur, "lens");
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
  // Body-only, in stock, Amazon left out: what the alert and the saved list compare (lib/price-rules.ts).
  const h = headline(offers);
  const self = product(l.slug)!;
  const rivals = rivalsOf(self);
  const bodies = camerasFor(l);
  const name = displayName(l, m);
  const short = displayShortName(l, m);
  const page = `lens-${m}-${l.slug}`;
  const cur = MARKETS[m].currency;
  const history = historyFor(l.slug, m);
  const used = usedValue(history);
  const brand = brandName(l.brand);
  const things = lensThings(l, { offers, currency: cur, market: m, marketName: MARKETS[m].name, used, todayUsed: h.used?.price ?? null });
  const rival = rivals[0] ? { item: rivals[0].item, brandName: brandName(rivals[0].item.brand) } : null;
  const compareHref = rivals[0] ? (isIndexedPair(self, rivals[0]) ? `/compare/${pairSlug(l, rivals[0].item)}` : marketPath(m, `/compare?c=${l.slug},${rivals[0].item.slug}`)) : null;
  const mountNames = l.mounts.map((x) => mount(x)).filter((x): x is NonNullable<typeof x> => x !== null);
  return (
    <article className="flex flex-col gap-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(productLd(l, "lens", offers, m))} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "Lenses", path: marketPath(m, "/lenses") }, { name: brand, path: marketPath(m, `/brands/${l.brand}`) }, { name, path: marketPath(m, `/lenses/${l.slug}`) }]))}
      />
      <div className="flex flex-col gap-5">
        <nav className="text-xs text-subtle" aria-label="Breadcrumb">
          <Link href={marketPath(m, "/lenses")}>Lenses</Link> / <Link href={marketPath(m, `/brands/${l.brand}`)}>{brand}</Link> / <span>{short}</span>
        </nav>
        <header className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)] md:gap-8">
          <Gallery slug={l.slug} images={galleryFor(l.slug, name)} />
          <div className="flex min-w-0 flex-col gap-4">
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
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                <ReviewStars slug={l.slug} />
                <OfficialLink p={l} />
              </p>
            </div>
            <KeySpecs l={l} />
            <PriceBox offers={offers} history={history} launch={launchPrice(l, m)} market={m} pack="lens" page={page} />
            <div className="flex flex-wrap gap-2">
              <PriceAlert slug={l.slug} kind="lens" market={m} newPrice={h.new?.price ?? null} usedPrice={h.used?.price ?? null} />
              {compareHref && rivals[0] && (
                <Link href={compareHref} className="btn-ghost">
                  Compare with {displayShortName(rivals[0].item, m)}
                </Link>
              )}
              <SaveButton slug={l.slug} kind="lens" market={m} seen={(h.new ?? h.used)?.price ?? null} cond={h.new ? "new" : "used"} />
            </div>
          </div>
        </header>
        <SpecHighlights items={lensHighlights(l)} />
      </div>

      <PageNav
        items={[
          { id: "prices", label: "Prices" },
          { id: "reviews", label: "Reviews" },
          { id: "things-to-know", label: "Things to know" },
          { id: "history", label: "Price history" },
          { id: "videos", label: "Videos" },
          { id: "discussions", label: "Discussions" },
          { id: "more-options", label: "More options" },
          { id: "specs", label: "Specs" },
        ]}
      />

      <section id="prices" className="scroll-mt-28">
        <h2 className="h-section mb-3">Where to buy the {short} in {MARKETS[m].name}</h2>
        <OffersTable product={l.slug} query={name} offers={offers} market={m} page={page} amazonAsin={l.amazonAsin} />
        {l.mounts.length > 1 && <p className="mt-2 text-xs text-subtle">Made in {l.mounts.length} mount versions. Check the version before you buy: each offer says which, when the retailer does.</p>}
      </section>

      <ProductReviews p={l} kind="lens" name={short} />

      <ThingsToKnow t={things} name={short} />

      {/* SLOT: price history. Owned by the history agent (components/PriceHistory.tsx); keep the id. */}
      <section id="history" className="scroll-mt-28">
        <h2 className="h-section mb-3">Price history</h2>
        <div className="card p-3">
          <PriceHistory slug={l.slug} market={m} currency={cur} />
        </div>
      </section>

      <WorldPrices slug={l.slug} path={`/lenses/${l.slug}`} market={m} name={short} />

      <section>
        <h2 className="h-section mb-3">Used: what it should be worth</h2>
        <UsedValue history={history} currency={cur} todayUsed={h.used?.price ?? null} name={l.shortName} />
      </section>

      <ProductVideos links={videoLinks(l, "lens", brand, rival)} name={short} />

      <ProductDiscussions links={discussionLinks(l, "lens", brand)} slug={l.slug} name={short} />

      <MoreOptions self={self} m={m} />

      <section id="specs" className="scroll-mt-28">
        <h2 className="h-section mb-3">{short} specifications</h2>
        <SpecSheet item={l} groups={LENS_SPEC_GROUPS} />
      </section>

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

      <AdSlot slot={AD_SLOTS.product} />
    </article>
  );
}
