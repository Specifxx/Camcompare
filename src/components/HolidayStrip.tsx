"use client";
// One line under the header on every page from 1 November to the day after Cyber Monday, linking the visitor's market's
// Black Friday page, then its Cyber Monday page (lib/black-friday.ts saleStrip, decided by the layout at the build;
// DECISIONS.md, "Black Friday strip and Cyber Monday page", 2026-11-07). Client only to follow the path's market, as the
// header does; prerendered into each page's HTML. A link, never a pop-up, a countdown or "ends soon".
import Link from "next/link";
import { usePathname } from "next/navigation";
import { marketPath } from "@/lib/markets";
import { useMarket } from "@/lib/market-client";

export default function HolidayStrip({ sale }: { sale: { path: string; name: string } | null }) {
  const pathname = usePathname() ?? "/";
  const m = useMarket(pathname);
  if (!sale) return null;
  return (
    <div className="border-b border-line bg-accent-soft" data-holiday-strip={sale.path.slice(1)}>
      <p className="mx-auto max-w-6xl truncate px-4 py-1.5 text-center text-xs sm:text-sm">
        <Link href={marketPath(m, sale.path)} prefetch={false} className="text-fg no-underline hover:underline">
          <b>{sale.name} camera deals</b><span className="hidden sm:inline"> · today&apos;s prices under launch RRP, updated daily</span> · <span className="font-semibold text-accent">see the deals →</span>
        </Link>
      </p>
    </div>
  );
}
