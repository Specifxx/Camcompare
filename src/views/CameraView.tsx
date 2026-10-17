import type { Metadata } from "next";
import Link from "next/link";
import AdSlot from "@/components/AdSlot";
import { AD_SLOTS } from "@/lib/ads";
import OffersTable from "@/components/OffersTable";
import LowLight from "@/components/LowLight";
import PeerRanks from "@/components/PeerRanks";
import PhotoCredit from "@/components/PhotoCredit";
import PriceBox from "@/components/PriceBox";
import PriceHistory from "@/components/PriceHistory";
import UsedValue from "@/components/UsedValue";
import ProductCard from "@/components/ProductCard";
import ProductThumb from "@/components/ProductThumb";
import SaveButton from "@/components/SaveButton";
import SpecHighlights from "@/components/SpecHighlights";
import SpecSheet from "@/components/SpecSheet";
import { cameraHighlights } from "@/lib/highlights";
import {
  brandName,
  camera as getCamera,
  credit,
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
import type { Camera } from "@/lib/catalog/schema";
import { price } from "@/lib/format";
import { breadcrumb, ldJson, productLd } from "@/lib/jsonld";
import { MARKETS, marketPath, type MarketCode } from "@/lib/markets";
import { lowest } from "@/lib/offers";
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
  const n = lowest(offers, "new");
  const u = lowest(offers, "used");
  const cur = MARKETS[m].currency;
  const name = displayName(c, m);
  const priceText = n ? ` New from ${price(n.price, cur)}${u ? `, used from ${price(u.price, cur)}` : ""}.` : u ? ` Used from ${price(u.price, cur)}.` : "";
  return pageMeta({
    title: `${name} price & specs`,
    description: `${name}: ${c.specs.megapixels} MP ${sensorLabel(c.specs.sensorFormat).toLowerCase()} ${typeLabel(c.type).toLowerCase()}, announced ${c.announced.slice(0, 4)}.${priceText} Full specs, price history and side-by-side comparisons.`,
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
  const groups = LENS_GROUPS.map((g) => ({ g, list: sums.filter(({ cats }) => cats.includes(g)).sort((a, b) => rank(a.s, b.s)).slice(0, 4) })).filter((x) => x.list.length);
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
  // The price box shows Amazon's price live, with its time (TimedPrice).
  const n = lowest(offers, "new", true);
  const u = lowest(offers, "used", true);
  const mt = c.mount ? mount(c.mount) : null;
  const self = product(c.slug)!;
  const rivals = rivalsOf(self);
  const family = [c.predecessor, c.successor].map((s) => (s ? product(s) : null)).filter((x): x is NonNullable<typeof x> => x !== null);
  const name = displayName(c, m);
  const short = displayShortName(c, m);
  const page = `cam-${m}-${c.slug}`;
  return (
    <article className="flex flex-col gap-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(productLd(c, "camera", offers, m))} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "Cameras", path: marketPath(m, "/cameras") }, { name: brandName(c.brand), path: marketPath(m, `/brands/${c.brand}`) }, { name, path: marketPath(m, `/cameras/${c.slug}`) }]))}
      />
      <div className="flex flex-col gap-6">
        <nav className="text-xs text-subtle" aria-label="Breadcrumb">
          <Link href={marketPath(m, "/cameras")}>Cameras</Link> / <Link href={marketPath(m, `/brands/${c.brand}`)}>{brandName(c.brand)}</Link> / <span>{short}</span>
        </nav>
        <header className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <figure>
            <ProductThumb slug={c.slug} alt={name} priority className="border border-line" />
            <PhotoCredit credit={credit(c.slug)} />
          </figure>
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{name}</h1>
              <p className="mt-1 text-sm text-muted">
                {typeLabel(c.type)} · {mt ? <Link href={marketPath(m, `/mounts/${mt.slug}`)}>{mt.name}</Link> : "Fixed lens"} · Announced {longMonthYear(c.announced)}
                {c.status === "discontinued" ? " · Discontinued (new stock may be limited)" : ""}
                {name !== c.name ? ` · Sold as ${c.name} in the US` : ""}
              </p>
            </div>
            <PriceBox newOffer={n} usedOffer={u} history={historyFor(c.slug, m)} launch={launchPrice(c, m)} market={m} extra={c.mount ? " (body only)" : ""} />
            <div className="flex flex-wrap gap-2">
              <SaveButton slug={c.slug} kind="camera" market={m} seen={(lowest(offers, "new") ?? lowest(offers, "used"))?.price ?? null} cond={lowest(offers, "new") ? "new" : "used"} />
              {rivals[0] && (
                <Link href={isIndexedPair(self, rivals[0]) ? `/compare/${pairSlug(c, rivals[0].item)}` : marketPath(m, `/compare?c=${c.slug},${rivals[0].item.slug}`)} className="btn-ghost">
                  Compare with {displayShortName(rivals[0].item, m)}
                </Link>
              )}
            </div>
          </div>
        </header>
        <SpecHighlights items={cameraHighlights(c)} />
      </div>

      <section id="prices">
        <h2 className="h-section mb-3">Where to buy the {short} in {MARKETS[m].name}</h2>
        <OffersTable product={c.slug} query={name.replace(/α/g, "a")} offers={offers} market={m} page={page} amazonAsin={c.amazonAsin} />
      </section>

      <section>
        <h2 className="h-section mb-3">Price history</h2>
        <div className="card p-4">
          <PriceHistory points={historyFor(c.slug, m)} currency={MARKETS[m].currency} />
        </div>
      </section>

      <section>
        <h2 className="h-section mb-3">Used: what it should be worth</h2>
        <UsedValue history={historyFor(c.slug, m)} currency={MARKETS[m].currency} todayUsed={lowest(offers, "used")?.price ?? null} name={short} />
      </section>

      <section>
        <h2 className="h-section mb-3">Low light & noise</h2>
        <LowLight cams={[{ c, brandName: brandName(c.brand) }]} />
      </section>

      <section>
        <h2 className="h-section mb-3">How it stacks up</h2>
        <PeerRanks camera={c} />
      </section>

      {(rivals.length > 0 || family.length > 0) && (
        <section>
          <h2 className="h-section mb-3">Compare the {short}</h2>
          <div className="flex flex-wrap gap-2">
            {[...family, ...rivals]
              .filter((x, i, arr) => arr.findIndex((y) => y.item.slug === x.item.slug) === i)
              .map((r) => (
                <Link key={r.item.slug} href={isIndexedPair(self, r) ? `/compare/${pairSlug(c, r.item)}` : marketPath(m, `/compare?c=${c.slug},${r.item.slug}`)} className="btn-ghost">
                  vs {displayName(r.item, m)}
                  {r.item.slug === c.predecessor ? <span className="text-xs font-normal text-subtle">(predecessor)</span> : r.item.slug === c.successor ? <span className="text-xs font-normal text-subtle">(successor)</span> : null}
                </Link>
              ))}
          </div>
        </section>
      )}

      <LensesForCamera c={c} m={m} />

      <section>
        <h2 className="h-section mb-3">{short} specifications</h2>
        <SpecSheet item={c} groups={SPEC_GROUPS} />
      </section>

      <AdSlot slot={AD_SLOTS.product} />
    </article>
  );
}
