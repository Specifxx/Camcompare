// "Accessories for the <camera>" on a camera page: per category (cages,
// batteries, grips, L-brackets, screen protectors first), the cheapest
// in-stock listing that names this camera, across shops and brands; flashes
// and triggers by the camera maker's system. Nothing when there is none.
import Link from "next/link";
import { accessoriesForCamera } from "@/lib/accessory-rows";
import { camera, displayShortName } from "@/lib/catalog";
import { price } from "@/lib/format";
import { marketPath, type MarketCode } from "@/lib/markets";
import OutboundLink from "./OutboundLink";

export default function CameraAccessories({ slug, market: m }: { slug: string; market: MarketCode }) {
  const c = camera(slug);
  const items = accessoriesForCamera(slug, m);
  if (!c || !items.length) return null;
  const short = displayShortName(c, m);
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="h-section">Accessories for the {short}</h2>
        <Link href={marketPath(m, "/accessories")} prefetch={false} className="shrink-0 text-sm">All accessories →</Link>
      </div>
      <ul className="card divide-y divide-line">
        {items.map(({ category, label, one, row, count, forModel }) => (
          <li key={category} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">{label}</p>
              <p className="truncate font-semibold leading-tight">{row.title}</p>
              <p className="mt-0.5 text-xs text-subtle">
                Cheapest {one} {forModel ? `for the ${short}` : "for this system"} at {row.retailerName} · {row.condition}
                {count > 1 ? (
                  <>
                    {" · "}
                    <Link href={marketPath(m, `/accessories/${category}?${forModel ? `camera=${slug}` : `cb=${c.brand}`}`)} prefetch={false}>
                      {count} options
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
            <p className="price shrink-0 font-bold">{price(row.price, row.currency)}</p>
            <div className="w-20 shrink-0 text-right">
              <OutboundLink href={row.href} retailer={row.retailer} product={slug} placement="camera-accessories" className={`${row.paid ? "btn-buy" : "btn-ghost"} w-full px-2`}>
                View<span className="sr-only"> at {row.retailerName}</span>
              </OutboundLink>
              {row.paid && <p className="mt-0.5 text-[10px] leading-none text-subtle">Paid link</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
