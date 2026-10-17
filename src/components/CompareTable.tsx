import Link from "next/link";
import type { Camera } from "@/lib/catalog/schema";
import { centsToUsd } from "@/lib/format";
import { lowest } from "@/lib/offers";
import { offersFor } from "@/lib/catalog";
import { SPEC_GROUPS, compareRows } from "@/lib/specs/definitions";
import CameraThumb from "./CameraThumb";
import CompareToggle from "./CompareToggle";

export default function CompareTable({ cameras }: { cameras: Camera[] }) {
  const lows = cameras.map((c) => ({ n: lowest(offersFor(c.slug), "new"), u: lowest(offersFor(c.slug), "used") }));
  return (
    <CompareToggle>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 140 + cameras.length * 150 }}>
          <colgroup>
            <col style={{ width: "22%" }} />
            {cameras.map((c) => (
              <col key={c.slug} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-line align-top">
              <th className="p-3" />
              {cameras.map((c) => (
                <th key={c.slug} className="p-3 text-left font-normal">
                  <Link href={`/cameras/${c.slug}`} className="block text-fg no-underline hover:no-underline">
                    <CameraThumb slug={c.slug} alt={c.name} className="mb-2 max-w-[220px]" />
                    <span className="font-semibold hover:text-accent">{c.name}</span>
                  </Link>
                </th>
              ))}
            </tr>
            <tr className="border-b border-line">
              <th className="p-3 text-left text-xs font-medium uppercase tracking-wide text-subtle">Lowest price today</th>
              {lows.map((l, i) => (
                <td key={cameras[i].slug} className="p-3">
                  {l.n ? <p><span className="price font-bold text-buy">{centsToUsd(l.n.priceCents)}</span> <span className="text-xs text-subtle">new</span></p> : null}
                  {l.u ? <p><span className="price font-semibold">{centsToUsd(l.u.priceCents)}</span> <span className="text-xs text-subtle">used</span></p> : null}
                  {!l.n && !l.u ? <Link href={`/cameras/${cameras[i].slug}#prices`} className="text-xs">Check retailers</Link> : null}
                </td>
              ))}
            </tr>
          </thead>
          {SPEC_GROUPS.map((g) => {
            const rows = compareRows(cameras, g);
            return (
              <tbody key={g.id}>
                <tr className="bg-raised">
                  <th colSpan={cameras.length + 1} className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-muted">
                    {g.title}
                  </th>
                </tr>
                {rows.map((r) => (
                  <tr key={r.def.key} data-same={r.allSame} className="border-b border-line last:border-0">
                    <th className="p-3 text-left align-top font-medium text-muted">
                      {r.def.label}
                      {r.def.help && <span className="mt-0.5 block text-[11px] font-normal text-subtle">{r.def.help}</span>}
                    </th>
                    {r.cells.map((cell, i) => (
                      <td key={cameras[i].slug} className={`p-3 align-top ${cell.win ? "font-semibold text-win" : ""}`}>
                        {cell.text ?? <span className="text-subtle">—</span>}
                        {cell.win && <span className="sr-only"> (best)</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
      </div>
      <p className="mt-2 text-xs text-subtle">Green marks the better figure where &ldquo;better&rdquo; is unambiguous. A dash means the maker doesn&apos;t publish it or we haven&apos;t verified it yet.</p>
    </CompareToggle>
  );
}
