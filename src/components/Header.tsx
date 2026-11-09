"use client";
// Client component so it can read the path: the same header serves the US
// root and the /uk /eu /au /sg trees, with links and the switcher following.
// On the global pages (/compare/<pair>, /guides…) they follow the visitor's
// market instead. Nav links don't prefetch: they are on every page, and their
// targets are the catalog's biggest payloads (or, for /compare, a function).
//
// Navigation audit (owner, 2026-11-09): one row from lg up, seven items:
// Cameras, Lenses, Brands and Systems open a dropdown, then Deals, Used and
// More. The dropdowns are ordinary links in the server HTML (CSS shows them on
// hover and focus, the chevron button on touch), built from ONE list
// (lib/nav.ts, lib/nav-data.ts) that the phone menu and the footer read too.
// Under lg, a strip of the same first-level sections and a menu button that
// opens the whole list, grouped.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Logo from "./brand/Logo";
import { MARKETS, marketPath, type MarketCode } from "@/lib/markets";
import { useMarket } from "@/lib/market-client";
import { groupLinks, isOnPath, type NavData, type NavGroup, type NavItem, type NavLink } from "@/lib/nav";
import { SITE_NAME } from "@/lib/site";
import MarketSwitcher from "./MarketSwitcher";
import SearchBox from "./SearchBox";
import { CartHeaderLink } from "./cart/CartHeaderLink";

const pill = (on: boolean) => `shrink-0 rounded-lg px-3 py-1.5 font-medium no-underline transition-colors hover:no-underline ${on ? "bg-accent-soft text-accent" : "text-muted hover:bg-raised hover:text-fg"}`;
const href = (m: MarketCode, l: NavLink) => (l.market ? marketPath(m, l.path) : l.path);
const Chevron = ({ open }: { open: boolean }) => (
  <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" className={`transition-transform ${open ? "rotate-180" : ""}`}>
    <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** One dropdown: its label is a real link; the panel's links are always in the HTML. */
function Dropdown({ item, groups, m, pathname, align = "left", cols }: { item: Pick<NavItem, "key" | "label" | "path">; groups: { group: NavGroup; links: NavLink[] }[]; m: MarketCode; pathname: string; align?: "left" | "right"; cols: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  const own = item.path ? href(m, { label: item.label, path: item.path, market: true }) : "";
  const on = (own !== "" && isOnPath(pathname, own)) || groups.some(({ links }) => links.some((l) => isOnPath(pathname, href(m, l)) && !l.path.includes("?")));
  const panelId = `nav-${item.key}`;
  return (
    <div ref={ref} className="group relative" onMouseLeave={() => setOpen(false)}>
      <div className={`flex items-center rounded-lg ${on || open ? "bg-accent-soft text-accent" : "text-muted hover:bg-raised hover:text-fg"}`}>
        {item.path ? (
          <>
            <Link href={own} prefetch={false} aria-current={isOnPath(pathname, own) ? "page" : undefined} className="rounded-l-lg py-1.5 pl-3 pr-1 font-medium text-inherit no-underline hover:no-underline">
              {item.label}
            </Link>
            <button type="button" aria-expanded={open} aria-controls={panelId} aria-label={`${item.label} menu`} onClick={() => setOpen(!open)} className="rounded-r-lg py-2 pl-1 pr-2 text-inherit">
              <Chevron open={open} />
            </button>
          </>
        ) : (
          <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 font-medium text-inherit">
            {item.label}
            <Chevron open={open} />
          </button>
        )}
      </div>
      <div id={panelId} className={`absolute top-full z-40 pt-2 ${align === "right" ? "right-0" : "left-0"} ${open ? "block" : "hidden"} group-hover:block group-focus-within:block`}>
        <div className={`grid gap-x-8 gap-y-5 rounded-xl border border-line bg-surface p-5 text-sm shadow-lift ${cols}`}>
          {groups.map(({ group, links }, i) => (
            <div key={`${group.title}-${i}`} className="min-w-0">
              {group.title && <p className="eyebrow mb-2 text-subtle">{group.title}</p>}
              <ul className="space-y-0.5">
                {links.map((l) => (
                  <li key={l.path}>
                    <Link href={href(m, l)} prefetch={false} className="block whitespace-nowrap rounded-md px-2 py-1 text-muted no-underline hover:bg-raised hover:text-fg hover:no-underline">
                      {l.label}
                      {l.hint && <span className="ml-2 text-xs text-subtle">{l.hint}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
              {group.all && (
                <Link href={href(m, group.all)} prefetch={false} className="mt-2 inline-block whitespace-nowrap px-2 text-sm font-semibold">
                  {group.all.label} →
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The phone menu: every destination, grouped, long lists folded. */
function PhoneMenu({ nav, m, pathname, onClose }: { nav: NavData; m: MarketCode; pathname: string; onClose: () => void }) {
  const link = (l: NavLink) => (
    <li key={l.path}>
      <Link href={href(m, l)} prefetch={false} onClick={onClose} aria-current={isOnPath(pathname, href(m, l)) && !l.path.includes("?") ? "page" : undefined} className="block rounded-lg px-3 py-2 text-base text-fg no-underline hover:bg-raised hover:no-underline">
        {l.label}
        {l.hint && <span className="ml-2 text-xs text-subtle">{l.hint}</span>}
      </Link>
    </li>
  );
  const heading = (t: string) => <p className="eyebrow px-3 pb-1 pt-4 text-subtle">{t}</p>;
  return (
    <nav aria-label="Menu" className="mx-auto max-h-[calc(100dvh-7.5rem)] max-w-6xl overflow-y-auto overscroll-contain border-t border-line/70 px-2 pb-6">
      {nav.menus.map((item) => {
        const folded = item.key === "brands" || item.key === "systems";
        const body = item.groups.map((g, i) => {
          const links = groupLinks(g, m, nav.uses);
          if (!links.length) return null;
          return (
            <div key={`${g.title}-${i}`}>
              {g.title && !folded && heading(g.title)}
              <ul>{links.map(link)}</ul>
              {g.all && <ul>{link(g.all)}</ul>}
            </div>
          );
        });
        return folded ? (
          <details key={item.key} className="border-t border-line/70 mt-2">
            <summary className="cursor-pointer list-none px-3 py-3 text-base font-semibold">{item.label}</summary>
            {body}
          </details>
        ) : (
          <div key={item.key} className="mt-2 border-t border-line/70">
            <Link href={marketPath(m, item.path)} prefetch={false} onClick={onClose} className="block px-3 pt-3 text-base font-semibold text-fg no-underline hover:no-underline">
              {item.label}
            </Link>
            {body}
          </div>
        );
      })}
      <div className="mt-2 border-t border-line/70">
        <ul>{nav.direct.map(link)}</ul>
      </div>
      {nav.more.map((g) => (
        <div key={g.title} className="mt-2 border-t border-line/70">
          {heading(g.title)}
          <ul>{g.links.map(link)}</ul>
        </div>
      ))}
    </nav>
  );
}

/** `sale`: Black Friday or Cyber Monday while the strip shows (lib/black-friday.ts saleStrip, decided by the layout at the build): the phone strip's first link. */
export default function Header({ nav, sale = null }: { nav: NavData; sale?: { path: string; name: string } | null }) {
  const pathname = usePathname() ?? "/";
  const m = useMarket(pathname);
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [pathname]);
  // The sale link leads the phone strip; on desktop the sale banner under the header carries it, so the seven stay seven.
  const direct = nav.direct;
  const resolved = (item: NavItem) => item.groups.map((group) => ({ group, links: groupLinks(group, m, nav.uses) })).filter((x) => x.links.length);
  const moreGroups = nav.more.map((group) => ({ group, links: group.links }));
  const cols = (n: number) => (n >= 4 ? "w-[46rem] grid-cols-4" : n === 3 ? "w-[34rem] grid-cols-3" : n === 2 ? "w-[22rem] grid-cols-2" : "w-[14rem] grid-cols-1");
  const strip: NavLink[] = [...(sale ? [{ label: sale.name, path: sale.path, market: true }] : []), ...nav.menus.map((i) => ({ label: i.label, path: i.path, market: true })), ...direct];
  return (
    <header className="cc-header glass sticky top-0 z-30">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-3">
        <Link href={marketPath(m, "/")} className="flex shrink-0 items-center text-fg no-underline hover:no-underline" aria-label={`${SITE_NAME} home`}>
          <Logo compact intro size={30} />
        </Link>
        <nav className="ml-1 hidden items-center gap-0.5 text-sm lg:flex" aria-label="Main">
          {nav.menus.map((item) => {
            const groups = resolved(item);
            return <Dropdown key={item.key} item={item} groups={groups} m={m} pathname={pathname} align="left" cols={cols(groups.length)} />;
          })}
          {direct.map((t) => {
            const h = href(m, t);
            return (
              <Link key={t.path} href={h} prefetch={false} aria-current={isOnPath(pathname, h) ? "page" : undefined} className={pill(isOnPath(pathname, h))}>
                {t.label}
              </Link>
            );
          })}
          <Dropdown item={{ key: "more", label: "More", path: "" }} groups={moreGroups} m={m} pathname={pathname} align="right" cols={cols(3)} />
        </nav>
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 lg:flex-none">
          <SearchBox market={m} />
          <MarketSwitcher current={m} />
          {/* The cart list (components/cart, owner 2026-11-06): every width, with its count. */}
          <CartHeaderLink className="shrink-0 text-muted hover:text-fg" />
          <button type="button" aria-expanded={menu} aria-controls="phone-menu" aria-label={menu ? "Close menu" : "Open menu"} onClick={() => setMenu(!menu)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-muted lg:hidden">
            <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              {menu ? <path d="M3 3l10 10M13 3 3 13" /> : <path d="M2 4h12M2 8h12M2 12h12" />}
            </svg>
          </button>
        </div>
      </div>
      <div className="border-t border-line/70 lg:hidden">
        <nav className="scrollbar-none mx-auto flex h-11 max-w-6xl items-center gap-0.5 overflow-x-auto px-2.5 text-[13px] sm:px-3 sm:text-sm" aria-label="Sections">
          {strip.map((n) => {
            const h = href(m, n);
            return (
              <Link key={n.path} href={h} prefetch={false} aria-current={isOnPath(pathname, h) ? "page" : undefined} className={pill(isOnPath(pathname, h))}>
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {menu && (
        <div id="phone-menu" className="lg:hidden">
          <PhoneMenu nav={nav} m={m} pathname={pathname} onClose={() => setMenu(false)} />
        </div>
      )}
      <span className="sr-only">{MARKETS[m].name} prices</span>
    </header>
  );
}
