import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { isIndexedPair, pairSlug, product, rivalsOf, type AnyProduct } from "@/lib/catalog";
import { marketPath, type MarketCode } from "@/lib/markets";
import { summarizeCamera, summarizeLens } from "@/lib/summary";
import { lineSiblings } from "@/lib/things-to-know";

type Choice = { p: AnyProduct; why: string };

/**
 * "More options": the successor and predecessor, same-line siblings and the
 * rivals buyers cross-shop (catalog data), as cards with today's price, and
 * a badge: "Newer model", "N% under RRP". Cards scroll sideways on a phone.
 */
export default function MoreOptions({ self, m, max = 6 }: { self: AnyProduct; m: MarketCode; max?: number }) {
  const it = self.item;
  const seen = new Set<string>([it.slug]);
  const picks: Choice[] = [];
  const add = (p: AnyProduct | null, why: string) => {
    if (!p || seen.has(p.item.slug) || p.kind !== self.kind) return;
    seen.add(p.item.slug);
    picks.push({ p, why });
  };
  add(it.successor ? product(it.successor) : null, "Newer model");
  for (const s of lineSiblings(it, self.kind)) add(product(s.slug), s.announced > it.announced ? "Newer model" : "Same line");
  add(it.predecessor ? product(it.predecessor) : null, "Older model");
  for (const r of rivalsOf(self)) add(r, "Rival");
  if (!picks.length) return null;
  const list = picks.slice(0, max);
  return (
    <section id="more-options" className="scroll-mt-28" aria-labelledby="more-h">
      <h2 id="more-h" className="h-section mb-3">
        More options
      </h2>
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-6">
        {list.map(({ p, why }) => {
          const s = p.kind === "camera" ? summarizeCamera(p.item, m) : summarizeLens(p.item, m);
          const rrp = s.launch ? s.launch * 100 : null;
          const under = rrp && s.lowestNew !== null && s.lowestNew < rrp ? Math.round(((rrp - s.lowestNew) / rrp) * 100) : 0;
          const vs = isIndexedPair(self, p) ? `/compare/${pairSlug(it, p.item)}` : marketPath(m, `/compare?c=${it.slug},${p.item.slug}`);
          return (
            <li key={p.item.slug} className="flex w-[160px] shrink-0 snap-start flex-col gap-1.5 sm:w-auto">
              <p className="flex min-h-[1.25rem] flex-wrap gap-1">
                <span className={`rounded px-1.5 py-px text-[11px] font-semibold ${why === "Newer model" ? "bg-accent-soft text-accent" : "bg-raised text-muted"}`}>{why}</span>
                {under >= 3 && <span className="rounded bg-buy-soft px-1.5 py-px text-[11px] font-semibold text-win">{under}% under RRP</span>}
              </p>
              <div className="flex-1">
                <ProductCard p={s} market={m} />
              </div>
              <Link href={vs} prefetch={false} className="text-xs">
                Compare side by side →
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
