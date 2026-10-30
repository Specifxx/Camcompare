import type { Metadata } from "next";
import Link from "next/link";
import AdOrPromo from "@/components/ebay/AdOrPromo";
import CameraAccessories from "@/components/CameraAccessories";
import { AD_SLOTS } from "@/lib/ads";
import { ebayRelatedLinks } from "@/lib/ebay-links";
import OffersTable from "@/components/OffersTable";
import LowLight from "@/components/LowLight";
import PeerRanks from "@/components/PeerRanks";
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
import SuggestedKit from "@/components/SuggestedKit";
import Gallery from "@/components/product/Gallery";
import MoreOptions from "@/components/product/MoreOptions";
import PageNav from "@/components/product/PageNav";
import ProductOverview from "@/components/product/ProductOverview";
import RelatedProducts from "@/components/product/RelatedProducts";
import { overview } from "@/lib/overview";
import { relatedFor } from "@/lib/related";
import ProductDiscussions from "@/components/product/ProductDiscussions";
import ProductReviews from "@/components/product/ProductReviews";
import ProductStories from "@/components/community/ProductStories";
import ProductVideos from "@/components/product/ProductVideos";
import ReviewStars from "@/components/product/ReviewStars";
import ThingsToKnow from "@/components/product/ThingsToKnow";
import { galleryFor } from "@/lib/gallery";
import { discussionLinks, videoLinks } from "@/lib/media-links";
import { headline, priceSentence } from "@/lib/price-rules";
import { cameraThings } from "@/lib/things-to-know";
import { usedValue } from "@/lib/value";
import { cameraHighlights } from "@/lib/highlights";
import {
  brandName,
  camera as getCamera,
  displayName,
  displayShortName,
  historyFor,
  isIndexedPair,
  launchPrice,
  lensesFor,
  lensCropsOn,
  mount,
  offersFor,
  pairSlug,
  product,
  rivalsOf,
} from "@/lib/catalog";
import { isGadget, type Camera } from "@/lib/catalog/schema";
import { gadgetPage } from "@/lib/curated";
import { breadcrumb, ldJson, productLd } from "@/lib/jsonld";
import { MARKETS, marketPath, type MarketCode } from "@/lib/markets";
import { pageMeta } from "@/lib/seo";
import { SPEC_GROUPS, lensLabel, sensorLabel, typeLabel } from "@/lib/specs/definitions";
import { CATEGORY_LABEL, cropOn, lensCategories, type LensCategory } from "@/lib/specs/lens";
import { summarizeLens } from "@/lib/summary";
import { longMonthYear } from "@/lib/format";

/** A product page outside the US is worth indexing only once that market has prices. */
export const marketIndexable = (slug: string) => (m: MarketCode) => m === "us" || offersFor(slug, m).length > 0;

export function cameraMetadata(slug: string, m: MarketCode): Metadata {
  const c = getCamera(slug);
  if (!c) return {};
  const offers = offersFor(c.slug, m);
  const cur = MARKETS[m].currency;
  const name = displayName(c, m);
  // The same headline rule as the page (lib/price-rules.ts): body only, else a kit, labelled.
  const priceText = priceSentence(offers, cur, c.mount ? "body" : "fixed");
  return pageMeta({
    title: `${name} price & specs`,
    description: `${name}: ${c.specs.megapixels} MP ${c.specs.sensorFormat ? `${sensorLabel(c.specs.sensorFormat).toLowerCase()} ` : ""}${typeLabel(c.type).toLowerCase()}, announced ${c.announced.slice(0, 4)}.${priceText} Full specs, price history and side-by-side comparisons.`,
    path: `/cameras/${c.slug}`,
    market: m,
    image: `/products/${c.slug}.webp`,
    index: marketIndexable(c.slug)(m),
    indexable: marketIndexable(c.slug),
  });
}

const LENS_GROUPS: LensCategory[] = ["standard", "wide", "ultra-wide", "telephoto", "super-telephoto", "macro"];

function LensesForCamera({ c, m }: { c: Camera; m: MarketCode }) {
  const lenses = lensesFor(c);
  if (!lenses.length || !c.mount) return null;
  const mt = mount(c.mount);
  // Within each group: priced lenses first (cheapest), then the newest.
  const rank = (a: ReturnType<typeof summarizeLens>, b: ReturnType<typeof summarizeLens>) =>
    Number(a.lowestNew === null) - Number(b.lowestNew === null) || (a.lowestNew ?? 0) - (b.lowestNew ?? 0) || b.announced.localeCompare(a.announced);
  // Grouped by what each lens is on THIS body: an RF 14-35mm is no ultra-wide on an EOS R7.
  const sums = lenses.map((l) => ({ l, s: summarizeLens(l, m), cats: lensCategories(l, cropOn(l, c)) }));
  const groups = LENS_GROUPS.map((g) => ({ g, list: sums.filter(({ cats }) => cats.includes(g)).sort((a, b) => rank(a.s, b.s)).slice(0, 3) })).filter((x) => x.list.length);
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="h-section">Lenses for the {displayShortName(c, m)}</h2>
        <Link href={marketPath(m, `/lenses?mount=${c.mount}`)} className="shrink-0 text-sm">All {lenses.length} {mt?.name ?? ""} lenses →</Link>
      </div>
      <div className="flex flex-col gap-5">
        {groups.map(({ g, list }) => (
          <div key={g}>
            <h3 className="mb-2 text-sm font-bold text-muted">{CATEGORY_LABEL[g]}</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {list.map(({ l, s }) => (
                <div key={l.slug}>
                  <ProductCard p={s} market={m} />
                  {lensCropsOn(l, c) && <p className="mt-1 text-[11px] text-warn">APS-C lens: crops the frame on this body</p>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function CameraView({ slug, market: m }: { slug: string; market: MarketCode }) {
  const c = getCamera(slug)!;
  const offers = offersFor(c.slug, m);
  // Body-only, in stock, Amazon left out: what the alert and the saved list compare (lib/price-rules.ts).
  const h = headline(offers);
  const mt = c.mount ? mount(c.mount) : null;
  const self = product(c.slug)!;
  const rivals = rivalsOf(self);
  const name = displayName(c, m);
  const short = displayShortName(c, m);
  const page = `cam-${m}-${c.slug}`;
  const cur = MARKETS[m].currency;
  const history = historyFor(c.slug, m);
  const used = usedValue(history);
  const things = cameraThings(c, { offers, currency: cur, market: m, marketName: MARKETS[m].name, used, todayUsed: h.used?.price ?? null });
  const brand = brandName(c.brand);
  const related = relatedFor(self);
  const over = overview({ self, m, name, goodFor: things.goodFor, notFor: things.notFor, history, launch: launchPrice(c, m), alternatives: [...rivals, ...related.alternatives].filter((p, i, a) => a.findIndex((q) => q.item.slug === p.item.slug) === i) });
  const rival = rivals[0] ? { item: rivals[0].item, brandName: brandName(rivals[0].item.brand) } : null;
  const compareHref = rivals[0] ? (isIndexedPair(self, rivals[0]) ? `/compare/${pairSlug(c, rivals[0].item)}` : marketPath(m, `/compare?c=${c.slug},${rivals[0].item.slug}`)) : null;
  return (
    <article className="flex flex-col gap-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(productLd(c, "camera", offers, m))} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "Cameras", path: marketPath(m, "/cameras") }, { name: brand, path: marketPath(m, `/brands/${c.brand}`) }, { name, path: marketPath(m, `/cameras/${c.slug}`) }]))}
      />
      <div className="flex flex-col gap-5">
        <nav className="text-xs text-subtle" aria-label="Breadcrumb">
          {gadgetPage(c.type) ? <Link href={marketPath(m, gadgetPage(c.type)!.path)}>{gadgetPage(c.type)!.label}</Link> : <Link href={marketPath(m, "/cameras")}>Cameras</Link>} / <Link href={marketPath(m, `/brands/${c.brand}`)}>{brand}</Link> / <span>{short}</span>
        </nav>
        {/* Hero: photo, then name, stars, the best price and the actions (shopping-panel order). */}
        <header className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)] md:gap-8">
          <Gallery slug={c.slug} images={galleryFor(c.slug, name)} />
          <div className="flex min-w-0 flex-col gap-4">
            <div>
              <h1 className="text-3xl font-extrabold leading-tight tracking-[-0.03em] sm:text-4xl">{name}</h1>
              <p className="mt-1 text-sm text-muted">
                {typeLabel(c.type)} · {mt ? <Link href={marketPath(m, `/mounts/${mt.slug}`)}>{mt.name}</Link> : isGadget(c.type) ? null : "Fixed lens"}{isGadget(c.type) ? "" : " ·"} Announced {longMonthYear(c.announced)}
                {c.status === "discontinued" ? " · Discontinued (new stock may be limited)" : ""}
                {name !== c.name ? ` · Sold as ${c.name} in the US` : ""}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                <ReviewStars slug={c.slug} />
                <OfficialLink p={c} />
              </p>
            </div>
            <PriceBox offers={offers} history={history} launch={launchPrice(c, m)} market={m} pack={c.mount ? "body" : "fixed"} page={page} extra={c.mount ? " (body)" : ""} />
            <div className="flex flex-wrap gap-2">
              <PriceAlert slug={c.slug} kind="camera" market={m} newPrice={h.new?.price ?? null} usedPrice={h.used?.price ?? null} />
              {compareHref && rivals[0] && (
                <Link href={compareHref} rel={compareHref.startsWith("/compare/") ? undefined : "nofollow"} className="btn-ghost">
                  Compare with {displayShortName(rivals[0].item, m)}
                </Link>
              )}
              <SaveButton slug={c.slug} kind="camera" market={m} seen={(h.new ?? h.used)?.price ?? null} cond={h.new ? "new" : "used"} />
            </div>
          </div>
        </header>
        <SpecHighlights items={cameraHighlights(c)} />
      </div>

      <ProductOverview o={over} name={short} />

      <PageNav
        items={[
          { id: "overview", label: "Overview" },
          { id: "prices", label: "Prices" },
          { id: "reviews", label: "Reviews" },
          { id: "things-to-know", label: "Things to know" },
          { id: "history", label: "Price history" },
          { id: "videos", label: "Videos" },
          { id: "discussions", label: "Discussions" },
          { id: "more-options", label: "More options" },
          { id: "related", label: "Alternatives" },
          { id: "specs", label: "Specs" },
        ]}
      />

      <section id="prices" className="scroll-mt-28">
        <h2 className="h-section mb-3">Where to buy the {short} in {MARKETS[m].name}</h2>
        <OffersTable product={c.slug} query={name.replace(/α/g, "a")} offers={offers} market={m} page={page} amazonAsin={c.amazonAsin} />
      </section>

      <ProductReviews p={c} kind="camera" name={short} />
      <ProductStories slug={c.slug} name={short} />

      <ThingsToKnow t={things} name={short} />

      {/* SLOT: price history. Owned by the history agent (components/PriceHistory.tsx); keep the id. */}
      <section id="history" className="scroll-mt-28">
        <h2 className="h-section mb-3">Price history</h2>
        <div className="card p-3">
          <PriceHistory slug={c.slug} market={m} currency={cur} />
        </div>
      </section>

      <WorldPrices slug={c.slug} path={`/cameras/${c.slug}`} market={m} name={short} />

      <section>
        <h2 className="h-section mb-3">Used: what it should be worth</h2>
        <UsedValue history={history} currency={cur} todayUsed={h.used?.price ?? null} name={short} />
      </section>

      <ProductVideos links={videoLinks(c, "camera", brand, rival)} name={short} />

      <ProductDiscussions links={discussionLinks(c, "camera", brand)} slug={c.slug} name={short} />

      <MoreOptions self={self} m={m} />

      <RelatedProducts self={self} m={m} related={related} name={short} />

      <section id="specs" className="scroll-mt-28">
        <h2 className="h-section mb-3">{short} specifications</h2>
        <SpecSheet item={c} groups={SPEC_GROUPS} />
      </section>

      {/* Pixel pitch and peer ranks are stills-camera measures: not for drones or camera glasses. */}
      {!isGadget(c.type) && (
        <>
          <section>
            <h2 className="h-section mb-3">Low light & noise</h2>
            <LowLight cams={[{ c, brandName: brand }]} />
          </section>

          <section>
            <h2 className="h-section mb-3">How it stacks up</h2>
            <PeerRanks camera={c} />
          </section>
        </>
      )}

      <SuggestedKit c={c} m={m} />

      <LensesForCamera c={c} m={m} />

      <CameraAccessories slug={c.slug} market={m} />

      <AdOrPromo slot={AD_SLOTS.product} market={m} page={page} placement="promo-product" title="More used gear on eBay" links={ebayRelatedLinks(m, page, "promo-product", { brand, mountName: mt?.name ?? null, kind: "camera" })} />
    </article>
  );
}
