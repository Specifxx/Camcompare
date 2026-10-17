// Wikidata + Wikimedia Commons, used by scripts only (never at request time):
//  - thumbnails: a camera's Commons photo (P18), freely licensed, with the
//    author and licence recorded in data/image-credits.json;
//  - identifiers: Exif model and GTIN, which make retailer matching exact;
//  - a cross-check of our specs (mass, announcement date, mount).
// Wikimedia asks bots for a descriptive User-Agent with a contact URL.
import { compact } from "./matching";
import type { Camera } from "./catalog/schema";

export const USER_AGENT = "CamCompareBot/0.1 (https://github.com/Specifxx/Camcompare)";
const SPARQL = "https://query.wikidata.org/sparql";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const DIGITAL_CAMERA_MODEL = "Q20741022";

export type WikidataCamera = {
  qid: string;
  label: string;
  altLabels: string[];
  maker: string | null;
  exifModels: string[];
  image: string | null; // Commons file name, without "File:"
  massG: number | null;
  announced: string | null;
  mount: string | null;
  gtins: string[];
};

async function sparql<T>(query: string): Promise<T[]> {
  const res = await fetch(`${SPARQL}?${new URLSearchParams({ query, format: "json" })}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/sparql-results+json" },
  });
  if (!res.ok) throw new Error(`Wikidata SPARQL ${res.status}`);
  return ((await res.json()) as { results: { bindings: T[] } }).results.bindings;
}

type B = Record<string, { value: string } | undefined>;

export async function fetchWikidataCameras(): Promise<WikidataCamera[]> {
  const rows = await sparql<B>(`
    SELECT ?cam ?label ?alt ?makerLabel ?exif ?image ?mass ?ann ?pub ?mountLabel ?gtin WHERE {
      ?cam wdt:P31 wd:${DIGITAL_CAMERA_MODEL} ; rdfs:label ?label . FILTER(LANG(?label) = "en")
      OPTIONAL { ?cam skos:altLabel ?alt . FILTER(LANG(?alt) = "en") }
      OPTIONAL { ?cam wdt:P176 ?maker }
      OPTIONAL { ?cam wdt:P2009 ?exif }
      OPTIONAL { ?cam wdt:P18 ?image }
      OPTIONAL { ?cam wdt:P2067 ?mass }
      OPTIONAL { ?cam wdt:P6949 ?ann }
      OPTIONAL { ?cam wdt:P577 ?pub }
      OPTIONAL { ?cam wdt:P2935 ?mount }
      OPTIONAL { ?cam wdt:P3962 ?gtin }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }`);
  const byQid = new Map<string, WikidataCamera>();
  for (const r of rows) {
    const qid = r.cam!.value.split("/").pop()!;
    let c = byQid.get(qid);
    if (!c) {
      c = { qid, label: r.label!.value, altLabels: [], maker: r.makerLabel?.value ?? null, exifModels: [], image: null, massG: null, announced: null, mount: null, gtins: [] };
      byQid.set(qid, c);
    }
    const add = (arr: string[], v?: string) => v && !arr.includes(v) && arr.push(v);
    add(c.altLabels, r.alt?.value);
    add(c.exifModels, r.exif?.value);
    add(c.gtins, r.gtin?.value);
    if (!c.image && r.image) c.image = decodeURIComponent(r.image.value.split("/Special:FilePath/").pop()!).replace(/_/g, " ");
    if (c.massG === null && r.mass) c.massG = Number(r.mass.value);
    const date = r.ann?.value ?? r.pub?.value;
    if (!c.announced && date) c.announced = date.slice(0, 10);
    if (!c.mount && r.mountLabel) c.mount = r.mountLabel.value;
  }
  return [...byQid.values()];
}

const MAKER_WORD: Record<string, RegExp> = {
  sony: /sony/i,
  canon: /canon/i,
  nikon: /nikon/i,
  fujifilm: /fuji/i,
  panasonic: /panasonic/i,
  "om-system": /olympus|om digital|om system/i,
  leica: /leica/i,
  ricoh: /ricoh|pentax/i,
  sigma: /sigma/i,
  hasselblad: /hasselblad/i,
};

/**
 * The Wikidata item for a catalog camera: an explicit `wikidata` id wins;
 * otherwise the item whose label, alt label or Exif model equals one of our
 * names once both are compacted, from the same maker. Only an UNAMBIGUOUS
 * match is returned.
 */
export function linkCamera(camera: Camera, items: WikidataCamera[]): WikidataCamera | null {
  if (camera.wikidata) return items.find((i) => i.qid === camera.wikidata) ?? null;
  const ours = new Set([camera.name, ...camera.aliases, ...camera.modelCodes].map(compact));
  const brandName = compact(camera.brand === "om-system" ? "olympus" : camera.brand);
  const stripBrand = (s: string) => s.replace(new RegExp(`^(${brandName}|omsystem|omdigital|pentax|fujifilm|fuji|lumix|panasonic)+`), "");
  for (const n of [...ours]) ours.add(stripBrand(n));
  const maker = MAKER_WORD[camera.brand];
  const hits = items.filter((i) => {
    if (i.maker && maker && !maker.test(i.maker)) return false;
    return [i.label, ...i.altLabels, ...i.exifModels].some((n) => {
      const k = compact(n);
      return ours.has(k) || ours.has(stripBrand(k));
    });
  });
  return hits.length === 1 ? hits[0] : null;
}

export type CommonsImage = {
  file: string;
  thumbUrl: string;
  pageUrl: string;
  author: string;
  license: string;
  licenseUrl: string | null;
};

const FREE = /^(cc0|cc[ -]by(-sa)?[ -]?\d|public domain|pd)/i;

/** The file's licence and a ~960px thumbnail URL, or null if it is not freely licensed. */
export async function commonsImage(file: string, width = 960): Promise<CommonsImage | null> {
  const params = new URLSearchParams({ action: "query", titles: `File:${file}`, prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: String(width), format: "json", formatversion: "2" });
  const res = await fetch(`${COMMONS_API}?${params}`, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Commons ${res.status}`);
  const page = ((await res.json()) as { query?: { pages?: { imageinfo?: { thumburl: string; descriptionurl: string; extmetadata: Record<string, { value: string } | undefined> }[] }[] } }).query?.pages?.[0];
  const info = page?.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata;
  const license = meta.LicenseShortName?.value ?? "";
  if (!FREE.test(license)) return null;
  const strip = (s?: string) => (s ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return {
    file,
    thumbUrl: info.thumburl,
    pageUrl: info.descriptionurl,
    author: strip(meta.Artist?.value) || "Unknown author",
    license,
    licenseUrl: meta.LicenseUrl?.value ?? null,
  };
}
