// Server half of /world pages: headings, the tables (components/WorldTable.tsx,
// client, for the currency picker) and the caveats. Static: catalog and
// offers files read at build, no revalidate, no request-time fetch.
import Link from "next/link";
import WorldTable, { WorldCurrencyPicker } from "@/components/WorldTable";
import { worldBrandName, worldFx, worldTable, WORLD_COLUMNS, type WorldLine } from "@/lib/world";

export function WorldIntro({ title, lead }: { title: string; lead: string }) {
  const fx = worldFx();
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-subtle">Global price comparison · {today}</p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">{lead}</p>
      </div>
      <div className="sticky top-14 z-10 -mx-4 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-3">
        <WorldCurrencyPicker date={fx.date} />
      </div>
    </div>
  );
}

export function WorldLineSection({ line, heading = "h2" }: { line: WorldLine; heading?: "h1" | "h2" }) {
  const data = worldTable(line);
  const { rates } = worldFx();
  if (!data.rows.length) return null;
  const H = heading;
  return (
    <section id={line.slug} className="flex scroll-mt-28 flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <H className="h-section">
          <Link href={`/world/${line.brand}/${line.slug}`} prefetch={false} className="text-fg">
            {worldBrandName(line.brand)} {line.name}
          </Link>
        </H>
        <span className="text-xs text-subtle">
          {data.rows.length} products · {data.priced} priced today
        </span>
      </div>
      <p className="text-sm text-muted">{line.blurb}</p>
      <WorldTable data={data} rates={rates} />
    </section>
  );
}

export function WorldCaveats() {
  const planned = WORLD_COLUMNS.filter((c) => !c.live);
  return (
    <section className="card flex flex-col gap-2 p-4 text-sm">
      <h2 className="font-bold">Before you buy abroad</h2>
      <ul className="list-disc space-y-1 pl-5 text-muted">
        <li>
          <strong className="text-fg">Approximate, at today&apos;s exchange rate.</strong> Each store charges in its own currency (shown under each figure); the ≈ figure is that price
          converted at the European Central Bank&apos;s reference rate. Your card or transfer will use a different rate and may add a fee.
        </li>
        <li>
          <strong className="text-fg">US list is the launch price.</strong> The maker&apos;s US list price when the product was announced, before US sales tax. Today&apos;s US price can be
          lower; it is the US column.
        </li>
        <li>
          <strong className="text-fg">Tax and duty.</strong> UK and EU prices include VAT, Australian prices GST and Singapore prices GST; US prices don&apos;t include sales tax. Bringing gear
          home can mean paying your own country&apos;s import duty and tax, and a tourist refund (VAT, GST) has its own rules and limits.
        </li>
        <li>
          <strong className="text-fg">Shipping.</strong> Stores often won&apos;t ship abroad, or charge for it. These are the stores&apos; own prices without shipping.
        </li>
        <li>
          <strong className="text-fg">Warranty.</strong> Many makers honour a warranty only in the region of sale. A camera bought abroad may need to go back there for repair. Read{" "}
          <Link href="/guides/grey-market-cameras">grey-market cameras</Link> before you buy.
        </li>
        <li>
          <strong className="text-fg">Only new, in stock, body only.</strong> The lowest new price at the authorised stores and marketplaces we track in each market; Amazon&apos;s prices are left
          out here (its licence allows them only live, beside its link), kits and used gear too.
        </li>
        <li>
          <strong className="text-fg">{planned.map((c) => c.label).join(" and ")} are coming.</strong> Buyers compare against them most, but we don&apos;t price those markets yet. The
          table is ready for them: a column appears the day we do.
        </li>
      </ul>
    </section>
  );
}
