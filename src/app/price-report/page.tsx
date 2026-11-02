import type { Metadata } from "next";
import Link from "next/link";
import { offersFor, offersGeneratedAt, publishedCameras, publishedLenses } from "@/lib/catalog";
import { MARKETS, MARKET_CODES } from "@/lib/markets";
import { SITE_NAME, abs } from "@/lib/site";
import { marketReport, pctText } from "@/lib/price-report";

// The self-updating monthly price report (DECISIONS.md, "Self-updating price report", 2026-11-02): static, built
// with the site from the committed prices (every price commit is a build), one URL kept for good.
const month = () => {
  const at = offersGeneratedAt("us");
  return (at ? new Date(at) : new Date()).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
};

export function generateMetadata(): Metadata {
  return {
    title: `Camera price report, ${month()}: store gaps and used savings`,
    description: "How much the same camera or lens costs from store to store this month in the US, UK, Europe, Australia and Singapore, and how much buying used or refurbished saves. Free to cite.",
    alternates: { canonical: "/price-report" },
  };
}

export default function PriceReport() {
  const at = offersGeneratedAt("us");
  const asOf = at ? new Date(at).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : null;
  const kinds = [
    { label: "Cameras", items: publishedCameras().map((p) => p.slug) },
    { label: "Lenses", items: publishedLenses().map((p) => p.slug) },
  ];
  const rows = MARKET_CODES.map((m) => ({ m, k: kinds.map((k) => ({ label: k.label, r: marketReport(k.items.map((s) => offersFor(s, m))) })) })).filter((x) => x.k.some((k) => k.r.newPriced > 0));
  const citation = `${SITE_NAME}, "Camera price report, ${month()}", ${abs("/price-report")}`;
  return (
    <div className="max-w-3xl space-y-4 text-sm leading-relaxed">
      <h1 className="text-2xl font-extrabold tracking-tight">Camera price report, {month()}</h1>
      <p>
        The same camera body or lens at the retailers we check in five markets: how far apart new prices are, and how much a used or refurbished one
        saves. Rebuilt with every price update{asOf ? `; last updated ${asOf}` : ""}. Free to quote with a link.
      </p>
      {kinds.map((k, i) => (
        <section key={k.label} className="space-y-2">
          <h2 className="h-section pt-2">{k.label}</h2>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase text-subtle">
                <tr><th className="px-3 py-2">Market</th><th className="px-3 py-2 text-right">Stores</th><th className="px-3 py-2 text-right">Priced new</th><th className="px-3 py-2 text-right">New price gap</th><th className="px-3 py-2 text-right">Used saves</th></tr>
              </thead>
              <tbody>
                {rows.map(({ m, k: ks }) => {
                  const r = ks[i].r;
                  return (
                    <tr key={m} className="border-t border-line">
                      <td className="px-3 py-2">{MARKETS[m].name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.stores}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.newPriced}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{pctText(r.medianGap)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{pctText(r.medianUsedSaving)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <p className="text-xs text-subtle">
        &ldquo;New price gap&rdquo;: for products two or more stores sell new and in stock, the median difference between the cheapest and the dearest
        store, as a share of the dearest. &ldquo;Used saves&rdquo;: for products with both, how far the cheapest in-stock used or refurbished price is
        under the cheapest new one (median). Body or lens only, never kits; Amazon is left out; each market in its own currency.
      </p>
      <h2 className="h-section pt-2">Quote this report</h2>
      <p>You&apos;re welcome to use any number here in an article, video or club post, with a link to this page. It updates itself, so the link stays current.</p>
      <p className="rounded bg-black/5 p-2 font-mono text-xs">{citation}</p>
      <p><Link href="/used" prefetch={false}>Used camera prices</Link> · <Link href="/deals" prefetch={false}>Today&apos;s deals</Link> · <Link href="/widgets" prefetch={false}>Free price links for your site</Link></p>
    </div>
  );
}
