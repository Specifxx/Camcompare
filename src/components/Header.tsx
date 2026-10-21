"use client";
// Client component so it can read the path: the same header serves the US
// root and the /uk /eu /au /sg trees, with links and the switcher following.
// On the global pages (/compare/<pair>, /guides…) they follow the visitor's
// market instead. Nav links don't prefetch: they are on every page, and their
// targets are the catalog's biggest payloads (or, for /compare, a function).
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./brand/Logo";
import { MARKETS, marketPath } from "@/lib/markets";
import { useMarket } from "@/lib/market-client";
import { SITE_NAME } from "@/lib/site";
import MarketSwitcher from "./MarketSwitcher";
import MoreMenu from "./MoreMenu";
import SearchBox from "./SearchBox";

const NAV = [
  { path: "/cameras", label: "Cameras" },
  { path: "/lenses", label: "Lenses" },
  { path: "/deals", label: "Deals" },
  { path: "/accessories", label: "Accessories" },
  { path: "/finder", label: "Finder" },
  { path: "/compare", label: "Compare" },
];

export default function Header() {
  const pathname = usePathname() ?? "/";
  const m = useMarket(pathname);
  return (
    <header className="cc-header glass sticky top-0 z-30">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-5">
        <Link href={marketPath(m, "/")} className="flex shrink-0 items-center text-fg no-underline hover:no-underline" aria-label={`${SITE_NAME} home`}>
          <Logo compact intro />
        </Link>
        <nav className="hidden items-center gap-4 text-sm font-medium md:flex">
          {NAV.map((n) => {
            const href = marketPath(m, n.path);
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link key={n.path} href={href} prefetch={false} className={`cc-nav-link no-underline transition-colors hover:no-underline ${active ? "text-fg" : "text-muted hover:text-fg"}`} aria-current={active ? "page" : undefined}>
                {n.label}
              </Link>
            );
          })}
          <MoreMenu market={m} pathname={pathname} />
        </nav>
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 md:flex-none">
          <SearchBox market={m} />
          <MarketSwitcher current={m} />
        </div>
      </div>
      <nav className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-line px-4 py-2.5 text-xs font-medium min-[380px]:text-[13px] md:hidden" aria-label="Sections">
        {NAV.map((n) => {
          const href = marketPath(m, n.path);
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link key={n.path} href={href} prefetch={false} aria-current={active ? "page" : undefined} className={`cc-nav-link shrink-0 no-underline hover:no-underline ${active ? "text-fg" : "text-muted"}`}>
              {n.label}
            </Link>
          );
        })}
        <MoreMenu market={m} pathname={pathname} className="shrink-0" />
      </nav>
      <span className="sr-only">{MARKETS[m].name} prices</span>
    </header>
  );
}
