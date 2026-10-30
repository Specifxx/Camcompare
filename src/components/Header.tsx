"use client";
// Client component so it can read the path: the same header serves the US
// root and the /uk /eu /au /sg trees, with links and the switcher following.
// On the global pages (/compare/<pair>, /guides…) they follow the visitor's
// market instead. Nav links don't prefetch: they are on every page, and their
// targets are the catalog's biggest payloads (or, for /compare, a function).
//
// Two rows, as on Compare Empire: the tools (deals, finder, compare, guides)
// beside the logo, and a strip of what we sell under it, which scrolls
// sideways on a phone. On a phone the tools lead the strip.
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./brand/Logo";
import { MARKETS, marketPath } from "@/lib/markets";
import { useMarket } from "@/lib/market-client";
import { SITE_NAME } from "@/lib/site";
import MarketSwitcher from "./MarketSwitcher";
import MoreMenu from "./MoreMenu";
import SearchBox from "./SearchBox";

/** The tools: top row from md up. `market: false` paths are global. */
const TOOLS = [
  { path: "/deals", label: "Deals", market: true },
  { path: "/finder", label: "Finder", market: true },
  { path: "/compare", label: "Compare", market: true },
  { path: "/guides", label: "Guides", market: false },
];

/** What we sell: the strip under the top row. */
const SECTIONS = [
  { path: "/cameras", label: "Cameras" },
  { path: "/lenses", label: "Lenses" },
  { path: "/drones", label: "Drones" },
  { path: "/smart-glasses", label: "Smart glasses" },
  { path: "/digicams", label: "Digicams" },
  { path: "/used", label: "Used" },
  { path: "/accessories", label: "Accessories" },
  { path: "/brands", label: "Brands" },
  { path: "/releases", label: "Just announced" },
];

const pill = (on: boolean) => `shrink-0 rounded-lg px-3 py-1.5 font-medium no-underline transition-colors hover:no-underline ${on ? "bg-accent-soft text-accent" : "text-muted hover:bg-raised hover:text-fg"}`;

export default function Header() {
  const pathname = usePathname() ?? "/";
  const m = useMarket(pathname);
  const isOn = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const tools = TOOLS.map((t) => ({ ...t, href: t.market ? marketPath(m, t.path) : t.path }));
  return (
    <header className="cc-header glass sticky top-0 z-30">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-4">
        <Link href={marketPath(m, "/")} className="flex shrink-0 items-center text-fg no-underline hover:no-underline" aria-label={`${SITE_NAME} home`}>
          <Logo compact intro size={30} />
        </Link>
        <nav className="ml-2 hidden items-center gap-0.5 text-sm md:flex" aria-label="Tools">
          {tools.map((t) => (
            <Link key={t.path} href={t.href} prefetch={false} aria-current={isOn(t.href) ? "page" : undefined} className={pill(isOn(t.href))}>
              {t.label}
            </Link>
          ))}
          <MoreMenu market={m} pathname={pathname} />
        </nav>
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 md:flex-none">
          <SearchBox market={m} />
          <MarketSwitcher current={m} />
          <MoreMenu market={m} pathname={pathname} icon className="shrink-0 md:hidden" />
        </div>
      </div>
      <div className="border-t border-line/70">
        <nav className="scrollbar-none mx-auto flex h-11 max-w-6xl items-center gap-0.5 overflow-x-auto px-2.5 text-[13px] sm:px-3 sm:text-sm" aria-label="Sections">
          {tools.map((t) => (
            <Link key={t.path} href={t.href} prefetch={false} aria-current={isOn(t.href) ? "page" : undefined} className={`${pill(isOn(t.href))} md:hidden`}>
              {t.label}
            </Link>
          ))}
          <span aria-hidden className="mx-1.5 h-5 w-px shrink-0 bg-line md:hidden" />
          {SECTIONS.map((n) => {
            const href = marketPath(m, n.path);
            return (
              <Link key={n.path} href={href} prefetch={false} aria-current={isOn(href) ? "page" : undefined} className={pill(isOn(href))}>
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <span className="sr-only">{MARKETS[m].name} prices</span>
    </header>
  );
}
