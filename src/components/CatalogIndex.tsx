import Link from "next/link";
import { displayShortName, offersFor } from "@/lib/catalog";
import { marketPath, type MarketCode } from "@/lib/markets";
import { catalogIndex } from "@/lib/related";

/**
 * Every published camera or lens as a plain link, by brand A-Z, under the
 * filterable grid on /cameras and /lenses. The grid draws its first 240 and
 * filters in the browser; this list is in the server HTML, so every product
 * is linked from its hub for crawlers and for anyone who wants the full list.
 */
export default function CatalogIndex({ kind, market: m }: { kind: "camera" | "lens"; market: MarketCode }) {
  const groups = catalogIndex(kind);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const path = kind === "camera" ? "/cameras" : "/lenses";
  return (
    <section className="mt-12" aria-labelledby="az-h">
      <h2 id="az-h" className="h-section mb-1">
        All {total} {kind === "camera" ? "cameras" : "lenses"} A–Z
      </h2>
      <p className="mb-4 text-sm text-muted">By brand. Each brand&apos;s page groups them by mount and type.</p>
      <div className="columns-1 gap-8 sm:columns-2 lg:columns-3">
        {groups.map((g) => (
          <div key={g.brand} className="mb-5 break-inside-avoid">
            <h3 className="mb-1 text-sm font-bold">
              <Link href={marketPath(m, `/brands/${g.brand}`)} prefetch={false}>
                {g.name}
              </Link>{" "}
              <span className="font-normal text-subtle">({g.items.length})</span>
            </h3>
            <ul className="text-sm leading-relaxed">
              {g.items.map((p) => (
                <li key={p.slug}>
                  <Link href={marketPath(m, `${path}/${p.slug}`)} prefetch={false} rel={m === "us" || offersFor(p.slug, m).length ? undefined : "nofollow"}>
                    {displayShortName(p, m)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
