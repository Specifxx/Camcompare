import Link from "next/link";
import { displayName, offersFor, productPath, type AnyProduct } from "@/lib/catalog";
import type { Camera, Lens } from "@/lib/catalog/schema";
import { marketPath, type MarketCode } from "@/lib/markets";
import { lowest } from "@/lib/offers";
import { SPEC_GROUPS, compareRows, type CompareRow } from "@/lib/specs/definitions";
import { LENS_SPEC_GROUPS } from "@/lib/specs/lens";
import ComparePrices, { FollowLink } from "./ComparePrices";
import CompareToggle from "./CompareToggle";
import ProductThumb from "./ProductThumb";

function groupsFor(items: AnyProduct[]): { id: string; title: string; rows: CompareRow<Camera | Lens>[] }[] {
  if (items[0]?.kind === "lens") {
    const lenses = items.map((p) => p.item as Lens);
    return LENS_SPEC_GROUPS.map((g) => ({ id: g.id, title: g.title, rows: compareRows(lenses, g) as CompareRow<Camera | Lens>[] }));
  }
  const cams = items.map((p) => p.item as Camera);
  return SPEC_GROUPS.map((g) => ({ id: g.id, title: g.title, rows: compareRows(cams, g) as CompareRow<Camera | Lens>[] }));
}

export default function CompareTable({ items, market, followVisitorMarket = false }: { items: AnyProduct[]; market: MarketCode; followVisitorMarket?: boolean }) {
  const slugs = items.map((p) => p.item.slug);
  const initial = slugs.map((s) => ({ n: lowest(offersFor(s, market), "new")?.price ?? null, u: lowest(offersFor(s, market), "used")?.price ?? null }));
  return (
    <CompareToggle>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 140 + items.length * 150 }}>
          <colgroup>
            <col style={{ width: "22%" }} />
            {items.map((p) => (
              <col key={p.item.slug} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-line align-top">
              <th className="p-3" />
              {items.map((p) => {
                const head = (
                  <>
                    <ProductThumb slug={p.item.slug} alt={p.item.name} className="mb-2 max-w-[220px]" />
                    <span className="font-semibold hover:text-accent">{displayName(p.item, market)}</span>
                  </>
                );
                const cls = "block text-fg no-underline hover:no-underline";
                return (
                  <th key={p.item.slug} className="p-3 text-left font-normal">
                    {/* A global pair page links to the product in the visitor's market. */}
                    {followVisitorMarket ? (
                      <FollowLink path={productPath(p)} className={cls}>
                        {head}
                      </FollowLink>
                    ) : (
                      <Link href={marketPath(market, productPath(p))} className={cls}>
                        {head}
                      </Link>
                    )}
                  </th>
                );
              })}
            </tr>
            <tr className="border-b border-line">
              <th className="p-3 text-left text-xs font-medium uppercase tracking-wide text-subtle">Lowest price today</th>
              <ComparePrices slugs={slugs} market={market} initial={initial} follow={followVisitorMarket} />
            </tr>
          </thead>
          {groupsFor(items).map((g) => (
            <tbody key={g.id}>
              <tr className="bg-raised">
                <th colSpan={items.length + 1} className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-muted">
                  {g.title}
                </th>
              </tr>
              {g.rows.filter((r) => !r.def.optional || r.cells.some((c) => c.text !== null)).map((r) => (
                <tr key={r.def.key} data-same={r.allSame} className="border-b border-line last:border-0">
                  <th className="p-3 text-left align-top font-medium text-muted">
                    {r.def.label}
                    {r.def.help && <span className="mt-0.5 block text-[11px] font-normal text-subtle">{r.def.help}</span>}
                  </th>
                  {r.cells.map((cell, i) => (
                    <td key={slugs[i]} className={`p-3 align-top ${cell.win ? "font-semibold text-win" : ""}`}>
                      {cell.text ?? <span className="text-subtle">—</span>}
                      {cell.win && <span className="sr-only"> (best)</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <p className="mt-2 text-xs text-subtle">Green marks the better figure where &ldquo;better&rdquo; is unambiguous. A dash means the maker doesn&apos;t publish it or we haven&apos;t verified it yet.</p>
    </CompareToggle>
  );
}
