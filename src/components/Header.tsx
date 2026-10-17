"use client";
// Client component so it can read the path: the same header serves the US
// root and the /uk /eu /au /sg trees, with links and the switcher following.
// On the global pages (/compare/<pair>, /guides…) they follow the visitor's
// market instead. Nav links don't prefetch: they are on every page, and their
// targets are the catalog's biggest payloads (or, for /compare, a function).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MARKETS, marketPath } from "@/lib/markets";
import { useMarket } from "@/lib/market-client";
import { SITE_NAME } from "@/lib/site";
import MarketSwitcher from "./MarketSwitcher";
import SearchBox from "./SearchBox";

const NAV = [
  { path: "/cameras", label: "Cameras" },
  { path: "/lenses", label: "Lenses" },
  { path: "/deals", label: "Deals" },
  { path: "/finder", label: "Finder" },
  { path: "/compare", label: "Compare" },
];

export default function Header() {
  const pathname = usePathname() ?? "/";
  const m = useMarket(pathname);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-5">
        <Link href={marketPath(m, "/")} className="flex shrink-0 items-center gap-2 text-fg no-underline hover:no-underline" aria-label={`${SITE_NAME} home`}>
          <svg aria-hidden width="26" height="26" viewBox="0 0 26 26" className="text-accent">
            <rect x="1" y="6" width="24" height="17" rx="4" fill="currentColor" />
            <rect x="8" y="2.5" width="10" height="5" rx="1.5" fill="currentColor" />
            <circle cx="13" cy="14.5" r="5.5" fill="rgb(var(--c-surface))" />
            <circle cx="13" cy="14.5" r="3" fill="currentColor" />
          </svg>
          <span className="hidden text-base font-extrabold tracking-tight sm:inline">{SITE_NAME}</span>
        </Link>
        <nav className="hidden items-center gap-4 text-sm font-medium md:flex">
          {NAV.map((n) => {
            const href = marketPath(m, n.path);
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link key={n.path} href={href} prefetch={false} className={active ? "text-fg" : "text-muted hover:text-fg"} aria-current={active ? "page" : undefined}>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 md:flex-none">
          <SearchBox market={m} />
          <MarketSwitcher current={m} />
        </div>
      </div>
      <nav className="flex gap-4 overflow-x-auto border-t border-line px-4 py-2 text-sm font-medium md:hidden" aria-label="Sections">
        {NAV.map((n) => (
          <Link key={n.path} href={marketPath(m, n.path)} prefetch={false} className="shrink-0 text-muted">
            {n.label}
          </Link>
        ))}
      </nav>
      <span className="sr-only">{MARKETS[m].name} prices</span>
    </header>
  );
}
