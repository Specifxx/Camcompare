// A guide or blog post: its Markdown, with each `[[block:args]]` line drawn
// from today's catalog and offers (lib/guide-blocks.ts). Server component.
import Link from "next/link";
import OutboundLink from "@/components/OutboundLink";
import ProductThumb from "@/components/ProductThumb";
import QuickViewHost from "@/components/QuickView";
import { affiliateUrl, isPaid, subId } from "@/lib/affiliate";
import { price } from "@/lib/format";
import { anyCamera, args, HOME, inline, pickRow, segments, specDefs, topSlugs, type PickRow } from "@/lib/guide-blocks";
import { guideHtml } from "@/lib/guides";
import { MARKETS } from "@/lib/markets";
import { retailer } from "@/lib/retailers";
import { num, sensorLabel } from "@/lib/specs/definitions";
import { BargainCard, bargains } from "@/views/DealsView";

export default function GuideBody({ slug, body }: { slug: string; body: string }) {
  const parts = segments(inline(body));
  let picks = 0;
  return (
    <>
      {parts.map((s, i) => {
        if ("md" in s) return <div key={i} className="prose-cc mt-6" dangerouslySetInnerHTML={{ __html: guideHtml(s.md) }} />;
        if (s.block === "picks" || s.block === "top") {
          const slugs = s.block === "top" ? topSlugs(s.arg) : s.arg.split(",").map((x) => x.trim());
          const rows = slugs.map(pickRow).filter((r): r is PickRow => r !== null);
          const start = picks;
          picks += rows.length;
          return rows.length ? <Picks key={i} rows={rows} page={slug} start={start} /> : null;
        }
        if (s.block === "specs") {
          const [list, keys] = s.arg.split("|");
          const cams = list.split(",").map((x) => anyCamera(x.trim())).filter((c): c is NonNullable<typeof c> => c !== null);
          return cams.length ? <SpecTable key={i} slugs={cams.map((c) => c.slug)} keys={keys?.split("+").map((k) => k.trim())} /> : null;
        }
        if (s.block === "deals") {
          const list = bargains(HOME, Number(args(s.arg).n ?? 8)).newBargains;
          return list.length ? (
            <div key={i} className="my-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {list.map((b) => <BargainCard key={b.slug} b={b} m={HOME} />)}
            </div>
          ) : null;
        }
        return null;
      })}
      <QuickViewHost />
    </>
  );
}

const cur = MARKETS[HOME].currency;
// Drones and glasses are camera types: every product page is /cameras/<slug>.
const pagePath = (r: PickRow) => `/cameras/${r.slug}`;

function Picks({ rows, page, start }: { rows: PickRow[]; page: string; start: number }) {
  return (
    <ol className="my-6 flex flex-col gap-3">
      {rows.map((r, i) => {
        const o = r.home.new;
        const href = o ? affiliateUrl(o.retailer, o.url, subId(`guide-${page}`, "pick")) : null;
        const paid = o && href ? isPaid(o.retailer, href) : false;
        const c = r.camera;
        const line = [c.specs.sensorFormat ? sensorLabel(c.specs.sensorFormat) : null, c.specs.megapixels ? `${num(c.specs.megapixels)} MP` : null, c.specs.video4kMaxFps ? `4K ${num(c.specs.video4kMaxFps)}p` : null, c.specs.flightTimeMin ? `${num(c.specs.flightTimeMin)} min flight` : null, c.specs.weightG ? `${num(c.specs.weightG)} g` : null].filter(Boolean).join(" · ");
        return (
          <li key={r.slug} className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="w-6 shrink-0 text-center font-mono text-sm text-subtle">{start + i + 1}</span>
              {r.published && <ProductThumb slug={r.slug} alt="" className="w-20 shrink-0" />}
              <div className="min-w-0">
                {r.published ? (
                  <Link href={pagePath(r)} prefetch={false} className="font-semibold text-fg">
                    {r.name}
                  </Link>
                ) : (
                  <span className="font-semibold">{r.name}</span>
                )}
                <p className="text-xs text-muted">{line}</p>
                {r.abroad.length > 0 && (
                  <p className="mt-0.5 text-xs text-subtle">
                    {r.abroad.map((a) => `${a.market.toUpperCase()} ${a.new ? price(a.new.price, MARKETS[a.market].currency) : `${price(a.used!.price, MARKETS[a.market].currency)} used`}`).join(" · ")}
                  </p>
                )}
              </div>
            </div>
            <div className="shrink-0 text-sm sm:text-right">
              {o && href ? (
                <>
                  <span className="text-xs text-subtle">New from </span>
                  <span className="price font-bold text-buy">{price(o.price, cur)}</span>
                  <OutboundLink href={href} retailer={o.retailer} product={r.slug} placement="guide-pick" className={`${paid ? "btn-buy" : "btn-ghost"} ml-2 px-3 py-1 text-xs`}>
                    {retailer(o.retailer)?.name ?? o.retailer}
                  </OutboundLink>
                  {paid && <p className="mt-0.5 text-[10px] leading-none text-subtle">Paid link</p>}
                </>
              ) : (
                <span className="text-xs text-subtle">No new price in the US today</span>
              )}
              {r.home.used && (
                <span className="block text-xs">
                  <span className="text-subtle">Used from </span>
                  <span className="price font-semibold">{price(r.home.used.price, cur)}</span>
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function SpecTable({ slugs, keys }: { slugs: string[]; keys?: string[] }) {
  const cams = slugs.map((s) => anyCamera(s)!);
  const defs = specDefs(keys, cams);
  return (
    <div className="my-6 overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-line bg-raised px-3 py-2 text-left font-semibold">Model</th>
            {defs.map((d) => (
              <th key={d.key} className="border border-line bg-raised px-3 py-2 text-left font-semibold">
                {d.label}
              </th>
            ))}
            <th className="border border-line bg-raised px-3 py-2 text-left font-semibold">US new today</th>
          </tr>
        </thead>
        <tbody>
          {cams.map((c) => {
            const r = pickRow(c.slug)!;
            return (
              <tr key={c.slug}>
                <td className="border border-line px-3 py-2 font-semibold">
                  {r.published ? (
                    <Link href={pagePath(r)} prefetch={false}>
                      {r.name}
                    </Link>
                  ) : (
                    r.name
                  )}
                </td>
                {defs.map((d) => (
                  <td key={d.key} className="border border-line px-3 py-2">
                    {d.format(c) ?? "–"}
                  </td>
                ))}
                <td className="border border-line px-3 py-2">{r.home.new ? <span className="price font-semibold">{price(r.home.new.price, cur)}</span> : <span className="text-subtle">–</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
