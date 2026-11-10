// Builds the navigation lists from the catalog (server only; the root layout calls it once per process).
// Only what is live is linked: a type, brand, mount or use with nothing behind it is left out, so no menu item is a dead end.
import { USE_INDEX_MIN, picksForUse, USE_KEYS } from "./uses";
import { brands, mounts, publishedCameras, publishedLenses } from "./catalog";
import { GADGET_PAGES, digicams, gadgets } from "./curated";
import { USES } from "./finder";
import { hubPath, liveHubs } from "./hubs";
import { MARKET_CODES, type MarketCode } from "./markets";
import { CAMERA_TYPES, FOCAL_GROUPS, SENSOR_SIZES, type NavData, type NavGroup, type NavLink } from "./nav";

const L = (label: string, path: string, market = true): NavLink => ({ label, path, market });
let cached: NavData | undefined;

export function navData(): NavData {
  if (cached) return cached;
  const cams = publishedCameras();
  const lenses = publishedLenses();
  const sensors = new Set(cams.map((c) => c.specs.sensorFormat));
  const types = new Set(cams.map((c) => c.type));
  const liveBrands = brands().filter((b) => cams.some((c) => c.brand === b.slug) || lenses.some((l) => l.brand === b.slug));
  const liveMounts = mounts()
    .map((mt) => ({ mt, bodies: cams.filter((c) => c.mount === mt.slug).length, lenses: lenses.filter((l) => l.mounts.includes(mt.slug)).length }))
    .filter((x) => x.bodies + x.lenses > 0);
  const byMount = [...liveMounts].sort((a, b) => b.bodies + b.lenses - (a.bodies + a.lenses));

  const typeLinks = CAMERA_TYPES.filter(([k]) => types.has(k as never)).map(([k, label]) => L(label, `/cameras?type=${k}`)); // the fallback; each market gets its live hubs (hubs below)
  if (digicams().length) typeLinks.splice(2, 0, L("Compact & digicams", "/digicams"));
  if (gadgets("drone").length) typeLinks.push(L("Drones", GADGET_PAGES.drone.path));
  if (gadgets("smart-glasses").length) typeLinks.push(L("Smart glasses", GADGET_PAGES["smart-glasses"].path));

  const sensorLinks = SENSOR_SIZES.filter(([k]) => sensors.has(k as never) || (k === "micro-four-thirds" && sensors.has("four-thirds" as never))).map(([k, label]) => L(label, `/cameras?sensor=${k}`));

  const cameraGroups: NavGroup[] = [
    { title: "Shop by type", links: typeLinks, fill: "types", all: L("All cameras", "/cameras") },
    { title: "Shop by sensor", links: sensorLinks, fill: "sensors" },
    { title: "Shop by budget", links: [], fill: "camera-budget" },
    { title: "Best cameras for…", links: [], fill: "uses", all: L("Camera finder", "/finder") },
  ];

  const lensGroups: NavGroup[] = [
    { title: "Shop by mount", links: byMount.filter((x) => x.lenses > 0).slice(0, 10).map(({ mt }) => L(mt.name, `/lenses?mount=${mt.slug}`)), all: L("All camera systems", "/mounts") },
    { title: "Shop by focal length", links: FOCAL_GROUPS.map(([k, label]) => L(label, `/lenses?focal=${k}`)), all: L("All lenses", "/lenses") },
    { title: "Shop by budget", links: [], fill: "lens-budget" },
  ];

  const brandCols = chunk(liveBrands.map((b) => L(b.name, `/brands/${b.slug}`)), 3);
  const systemCols = chunk(byMount.map(({ mt, bodies, lenses: n }) => ({ ...L(mt.name, `/mounts/${mt.slug}`), hint: `${bodies} bodies · ${n} lenses` })), 2);

  const uses = Object.fromEntries(
    MARKET_CODES.map((m: MarketCode) => [m, USE_KEYS.filter((u) => picksForUse(u, m).top.length >= USE_INDEX_MIN).map((u) => L(USES[u].label, `/cameras-for/${u}`))]),
  ) as NavData["uses"];

  const hubLinks = (kind: "type" | "sensor") =>
    Object.fromEntries(
      MARKET_CODES.map((m: MarketCode) => {
        const links = liveHubs(kind, m).map((h) => L(h.label, hubPath(h)));
        if (kind === "type") links.push(...typeLinks.filter((l) => !l.path.startsWith("/cameras?type="))); // compacts, drones, glasses: their own pages, as before
        return [m, links];
      }),
    ) as NavData["uses"];

  cached = {
    hubs: { types: hubLinks("type"), sensors: hubLinks("sensor") },
    menus: [
      { key: "cameras", label: "Cameras", path: "/cameras", groups: cameraGroups },
      { key: "lenses", label: "Lenses", path: "/lenses", groups: lensGroups },
      { key: "brands", label: "Brands", path: "/brands", groups: brandCols.map((links, i) => ({ title: i === 0 ? "Camera and lens makers" : "", links, ...(i === brandCols.length - 1 ? { all: L("All brands", "/brands") } : {}) })) },
      { key: "systems", label: "Systems", path: "/mounts", groups: systemCols.map((links, i) => ({ title: i === 0 ? "Lens mounts" : "", links, ...(i === systemCols.length - 1 ? { all: L("All camera systems", "/mounts") } : {}) })) },
    ],
    direct: [L("Deals", "/deals"), L("Used", "/used")],
    more: [
      { title: "Tools", links: [L("Camera finder", "/finder"), L("Compare side by side", "/compare"), L("Is this a good price?", "/is-this-a-good-price", false), L("Prices around the world", "/world", false)] },
      { title: "Browse", links: [L("Accessories", "/accessories"), L("Digicams", "/digicams"), L("Drones", "/drones"), L("Smart glasses", "/smart-glasses"), L("Viral cameras", "/viral-cameras"), L("Just announced", "/releases")] },
      { title: "Learn and join in", links: [L("Guides", "/guides", false), L("Community", "/community", false), L("Member stories", "/stories", false), L("My gear", "/collection", false), L("Creators", "/creators", false), L("Requests", "/requests", false)] },
    ],
    uses,
  };
  return cached;
}

function chunk<T>(list: T[], cols: number): T[][] {
  const per = Math.ceil(list.length / cols);
  return Array.from({ length: cols }, (_, i) => list.slice(i * per, (i + 1) * per)).filter((c) => c.length);
}
