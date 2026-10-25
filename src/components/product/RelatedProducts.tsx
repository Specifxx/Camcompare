import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { brandName, displayShortName, mount, offersFor, publishedCameras, publishedLenses, type AnyProduct } from "@/lib/catalog";
import { marketPath, type MarketCode } from "@/lib/markets";
import type { relatedFor } from "@/lib/related";
import { summarizeCamera, summarizeLens } from "@/lib/summary";

/**
 * Below "More options": similar products of any brand as cards, then plain
 * links to more from the same maker and the same mount, each with its hub.
 * The picks are lib/related.ts's, no product twice on a page.
 */
export default function RelatedProducts({ self, m, related, name }: { self: AnyProduct; m: MarketCode; related: ReturnType<typeof relatedFor>; name: string }) {
  const { alternatives, sameBrand, sameMount } = related;
  const noun = self.kind === "camera" ? "cameras" : "lenses";
  const brand = brandName(self.item.brand);
  const mt = sameMount ? mount(sameMount.mount) : null;
  const brandCount = (self.kind === "camera" ? publishedCameras() : publishedLenses()).filter((x) => x.brand === self.item.brand).length;
  if (!alternatives.length && !sameBrand.length && !sameMount?.list.length) return null;
  return (
    <section id="related" className="scroll-mt-28 flex flex-col gap-6" aria-labelledby="related-h">
      <h2 id="related-h" className="h-section">
        Alternatives to the {name}
      </h2>
      {alternatives.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {alternatives.map((p) => (
            <ProductCard key={p.item.slug} p={p.kind === "camera" ? summarizeCamera(p.item, m) : summarizeLens(p.item, m)} market={m} />
          ))}
        </div>
      )}
      <div className="grid gap-6 sm:grid-cols-2">
        {sameBrand.length > 0 && (
          <LinkList
            title={`More ${brand} ${noun}`}
            items={sameBrand}
            m={m}
            hub={{ href: marketPath(m, `/brands/${self.item.brand}`), text: `All ${brandCount} ${brand} ${noun} →` }}
          />
        )}
        {sameMount && sameMount.list.length > 0 && mt && (
          <LinkList
            title={self.kind === "camera" ? `Other ${mt.name} cameras` : `More ${mt.name} lenses like it`}
            items={sameMount.list}
            m={m}
            brandFirst
            hub={{ href: marketPath(m, `/mounts/${mt.slug}`), text: `The ${mt.name} system: every body and lens →` }}
          />
        )}
      </div>
    </section>
  );
}

function LinkList({ title, items, m, hub, brandFirst = false }: { title: string; items: AnyProduct[]; m: MarketCode; hub: { href: string; text: string }; brandFirst?: boolean }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-bold text-muted">{title}</h3>
      <ul className="flex flex-col gap-1 text-sm">
        {items.map((p) => {
          const listed = m === "us" || offersFor(p.item.slug, m).length > 0;
          return (
            <li key={p.item.slug}>
              <Link href={marketPath(m, `/${p.kind === "camera" ? "cameras" : "lenses"}/${p.item.slug}`)} prefetch={false} rel={listed ? undefined : "nofollow"}>
                {brandFirst || p.item.brand !== items[0].item.brand ? `${brandName(p.item.brand)} ` : ""}
                {displayShortName(p.item, m)}
              </Link>{" "}
              <span className="text-subtle">· {p.item.announced.slice(0, 4)}</span>
            </li>
          );
        })}
      </ul>
      <Link href={hub.href} prefetch={false} className="mt-2 inline-block text-sm font-semibold">
        {hub.text}
      </Link>
    </div>
  );
}
