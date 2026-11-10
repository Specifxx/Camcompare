// The site's navigation, ONE source list (owner, 2026-11-09 navigation audit): the header's dropdowns, the phone menu
// and the footer's "Shop" column all read it. Client-safe constants and types; the lists that depend on the catalog
// (which brands, mounts and types are live) are built by lib/nav-data.ts, which only the root layout calls.
// Every link is an ordinary href, rendered in the server HTML. The camera type and sensor links open their own hub pages (lib/hubs.ts); a filter link (?mount=, ?budget=) opens the
// /cameras or /lenses finder with that filter set; the finder's canonical is the bare page, so no thin faceted page is indexed.
import type { MarketCode } from "./markets";

export type NavLink = { label: string; path: string; /** The path follows the visitor's market. */ market: boolean; hint?: string };
/** `fill`: links that depend on the visitor's market (currency tiers; the uses with priced picks there), added by `groupLinks`. */
export type NavGroup = { title: string; links: NavLink[]; all?: NavLink; fill?: "camera-budget" | "lens-budget" | "uses" | "types" | "sensors" };
export type NavItem = { key: string; label: string; path: string; groups: NavGroup[] };
export type NavData = {
  /** Header items with a dropdown, in order. */
  menus: NavItem[];
  /** Plain header links after the menus. */
  direct: NavLink[];
  /** Everything else (the "More" menu and the phone menu's last group). */
  more: NavGroup[];
  /** Per market, the /cameras-for/<use> pages that hold enough priced picks there (no dead ends). */
  uses: Record<MarketCode, NavLink[]>;
  /** Per market, the /cameras/type and /cameras/sensor hubs that hold enough priced cameras there (lib/hubs.ts). */
  hubs: { types: Record<MarketCode, NavLink[]>; sensors: Record<MarketCode, NavLink[]> };
};

export const CAMERA_TYPES: [string, string][] = [
  ["mirrorless", "Mirrorless"],
  ["dslr", "DSLR"],
  ["medium-format", "Medium format"],
  ["rangefinder", "Rangefinder"],
  ["action", "Action"],
  ["360", "360°"],
  ["cinema", "Cinema"],
];
export const SENSOR_SIZES: [string, string][] = [
  ["full-frame", "Full frame"],
  ["aps-c", "APS-C"],
  ["micro-four-thirds", "Micro Four Thirds"],
  ["medium-format", "Medium format"],
];
export const FOCAL_GROUPS: [string, string][] = [
  ["ultra-wide", "Ultra-wide (under 20mm)"],
  ["wide", "Wide (20-35mm)"],
  ["standard", "Standard (35-70mm)"],
  ["short-tele", "Short tele (70-135mm)"],
  ["tele", "Tele (135-300mm)"],
  ["super-tele", "Super-tele (300mm+)"],
];

/** The finder's budget steps (Browser.tsx `budgets`) that read as three price tiers in each market's currency. */
const TIERS: Record<MarketCode, [number, number, number]> = {
  us: [500, 1000, 2000],
  uk: [500, 1000, 2000],
  eu: [500, 1000, 2000],
  au: [800, 1500, 3000],
  sg: [800, 1500, 3000],
};
const SYMBOL: Record<MarketCode, string> = { us: "$", uk: "£", eu: "€", au: "A$", sg: "S$" };

export function budgetLinks(m: MarketCode, kind: "cameras" | "lenses" = "cameras"): NavLink[] {
  const [a, b, c] = TIERS[m];
  const sym = SYMBOL[m];
  const f = (n: number) => `${sym}${n.toLocaleString("en-US")}`;
  return [
    { label: `Under ${f(a)}`, path: `/${kind}?budget=${a}`, market: true },
    { label: `Under ${f(b)}`, path: `/${kind}?budget=${b}`, market: true },
    { label: `Under ${f(c)}`, path: `/${kind}?budget=${c}`, market: true },
  ];
}

/** True when `pathname` is `href` or below it (query and hash ignored). */
export const isOnPath = (pathname: string, href: string) => {
  const h = href.split("?")[0];
  return pathname === h || pathname.startsWith(`${h}/`);
};

export function groupLinks(g: NavGroup, m: MarketCode, uses: NavData["uses"], hubs?: NavData["hubs"]): NavLink[] {
  if (g.fill === "camera-budget") return budgetLinks(m, "cameras");
  if (g.fill === "lens-budget") return budgetLinks(m, "lenses");
  if (g.fill === "uses") return uses[m];
  if (g.fill === "types") return hubs ? hubs.types[m] : g.links;
  if (g.fill === "sensors") return hubs ? hubs.sensors[m] : g.links;
  return g.links;
}
