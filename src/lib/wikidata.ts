// Wikidata + Wikimedia Commons, used by scripts only (never at request time):
//  - thumbnails: a camera's Commons photo (P18), freely licensed, with the
//    author and licence recorded in data/image-credits.json;
//  - identifiers: Exif model and GTIN, which make retailer matching exact;
//  - a cross-check of our specs (mass, announcement date, mount).
// Wikimedia asks bots for a descriptive User-Agent with a contact URL.
import { compact } from "./matching";

/** What linking needs from a camera or a lens. */
type Linkable = { slug: string; brand: string; name: string; aliases: string[]; modelCodes: string[]; wikidata?: string };

export const USER_AGENT = "CamCompareBot/0.1 (https://github.com/Specifxx/Camcompare)";
const SPARQL = "https://query.wikidata.org/sparql";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
export const WD_CLASS = { camera: "Q20741022", lens: "Q109672300" } as const; // digital camera model; photographic lens model

export type WikidataCamera = {
  qid: string;
  label: string;
  altLabels: string[];
  maker: string | null;
  exifModels: string[];
  image: string | null; // Commons file name, without "File:"
  massG: number | null;
  announced: string | null;
  mounts: string[]; // every P2935 "connector": lens mounts, but also hot shoes, HDMI, USB
  gtins: string[];
};

/** fetch with patience for Wikimedia's 429s (shared egress IPs hit them). */
export async function politeFetch(url: string, tries = 5): Promise<Response> {
  for (let i = 0; ; i++) {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json, application/sparql-results+json" } });
    if (res.status !== 429 && res.status !== 503) return res;
    if (i >= tries - 1) return res;
    await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
  }
}

async function sparql<T>(query: string): Promise<T[]> {
  const res = await politeFetch(`${SPARQL}?${new URLSearchParams({ query, format: "json" })}`);
  if (!res.ok) throw new Error(`Wikidata SPARQL ${res.status}`);
  return ((await res.json()) as { results: { bindings: T[] } }).results.bindings;
}

type B = Record<string, { value: string } | undefined>;

export async function fetchWikidataCameras(kind: keyof typeof WD_CLASS = "camera"): Promise<WikidataCamera[]> {
  const rows = await sparql<B>(`
    SELECT ?cam ?label ?alt ?makerLabel ?exif ?image ?mass ?ann ?pub ?mountLabel ?gtin WHERE {
      ?cam wdt:P31 wd:${WD_CLASS[kind]} ; rdfs:label ?label . FILTER(LANG(?label) = "en")
      OPTIONAL { ?cam skos:altLabel ?alt . FILTER(LANG(?alt) = "en") }
      OPTIONAL { ?cam wdt:P176 ?maker }
      OPTIONAL { ?cam wdt:P2009 ?exif }
      OPTIONAL { ?cam wdt:P18 ?image }
      OPTIONAL { ?cam p:P2067/psn:P2067/wikibase:quantityAmount ?mass }
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
      c = { qid, label: r.label!.value, altLabels: [], maker: r.makerLabel?.value ?? null, exifModels: [], image: null, massG: null, announced: null, mounts: [], gtins: [] };
      byQid.set(qid, c);
    }
    const add = (arr: string[], v?: string) => v && !arr.includes(v) && arr.push(v);
    add(c.altLabels, r.alt?.value);
    add(c.exifModels, r.exif?.value);
    add(c.gtins, r.gtin?.value);
    add(c.mounts, r.mountLabel?.value);
    if (!c.image && r.image) c.image = decodeURIComponent(r.image.value.split("/Special:FilePath/").pop()!).replace(/_/g, " ");
    if (c.massG === null && r.mass) c.massG = Math.round(Number(r.mass.value) * 1000); // normalised to kg, whatever unit was stated
    const date = r.ann?.value ?? r.pub?.value;
    if (!c.announced && date) c.announced = date.slice(0, 10);
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
  gopro: /gopro/i,
  dji: /dji/i,
  insta360: /insta360|arashi/i,
  blackmagic: /blackmagic/i,
  red: /red digital|^red$/i,
  tamron: /tamron/i,
  samyang: /samyang|rokinon/i,
  viltrox: /viltrox/i,
  tokina: /tokina|kenko/i,
  laowa: /laowa|venus/i,
  ttartisan: /ttartisan/i,
  "7artisans": /7artisans/i,
  zeiss: /zeiss/i,
  voigtlander: /voigtl|cosina/i,
  sirui: /sirui/i,
  meike: /meike/i,
};

/**
 * The Wikidata item for a catalog camera: an explicit `wikidata` id wins.
 * Otherwise the item from the same maker whose label, alt label or Exif
 * model equals one of our names once both are compacted. Wikidata holds
 * thousands of phone and point-and-shoot stubs ("QMobile Noir Z9", "Ricoh GR
 * Digital III" alias "GR 3"), so candidates are ranked: the label equal to
 * our full name, then any label, then a brand-stripped or Exif match. Only an
 * unambiguous best match is returned.
 */
export function linkCamera(camera: Linkable, items: WikidataCamera[]): WikidataCamera | null {
  if (camera.wikidata) return items.find((i) => i.qid === camera.wikidata) ?? null;
  const ours = new Set([camera.name, ...camera.aliases, ...camera.modelCodes].map(compact));
  const brandName = compact(camera.brand === "om-system" ? "olympus" : camera.brand);
  const stripBrand = (s: string) => s.replace(new RegExp(`^(${brandName}|omsystem|omdigital|olympus|pentax|ricoh|fujifilm|fuji|lumix|panasonic|canon|nikon|sony|leica|sigma|hasselblad)+`), "");
  const oursStripped = new Set([...ours].map(stripBrand));
  const full = compact(camera.name);
  const maker = MAKER_WORD[camera.brand];
  const scored = items
    .filter((i) => (i.maker ? !maker || maker.test(i.maker) : maker?.test(i.label)))
    .map((i) => {
      const labels = [i.label, ...i.altLabels].map(compact);
      const score = compact(i.label) === full ? 3 : labels.some((l) => ours.has(l)) ? 2 : [...labels, ...i.exifModels.map(compact)].some((l) => ours.has(l) || oursStripped.has(stripBrand(l))) ? 1 : 0;
      return { i, score };
    })
    .filter((x) => x.score > 0);
  const best = Math.max(0, ...scored.map((x) => x.score));
  const top = scored.filter((x) => x.score === best);
  return top.length === 1 ? top[0].i : null;
}

/**
 * linkCamera for the whole catalog. Wikidata sometimes folds a variant into
 * its parent (the Lumix S5IIX is an alt label of the S5II item); when two
 * cameras land on one item, only the one whose name IS the item's label
 * keeps it.
 */
export function linkAll(cameras: Linkable[], items: WikidataCamera[]): Map<string, WikidataCamera> {
  const links = new Map<string, WikidataCamera>();
  const byQid = new Map<string, Linkable[]>();
  for (const c of cameras) {
    const w = linkCamera(c, items);
    if (w) byQid.set(w.qid, [...(byQid.get(w.qid) ?? []), c]);
  }
  for (const [qid, cams] of byQid) {
    const w = items.find((i) => i.qid === qid)!;
    const keep = cams.length === 1 ? cams : cams.filter((c) => c.wikidata === qid || compact(c.name) === compact(w.label));
    if (keep.length === 1) links.set(keep[0].slug, w);
  }
  return links;
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
  const res = await politeFetch(`${COMMONS_API}?${params}`);
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

/**
 * Fallback when Wikidata has no photo: search Commons file names. A file only
 * qualifies if the listing matcher would call its NAME this camera (brand
 * named, model as whole words, no accessory words), and it is not a sample
 * shot taken WITH the camera. Results are reviewed by eye before publishing
 * (scripts/fetch-thumbnails.ts writes a contact sheet).
 */
export async function searchCommonsFiles(query: string, limit = 20): Promise<string[]> {
  const params = new URLSearchParams({ action: "query", list: "search", srnamespace: "6", srsearch: query, srlimit: String(limit), format: "json", formatversion: "2" });
  const res = await politeFetch(`${COMMONS_API}?${params}`);
  if (!res.ok) throw new Error(`Commons search ${res.status}`);
  const body = (await res.json()) as { query?: { search?: { title: string }[] } };
  return (body.query?.search ?? []).map((r) => r.title.replace(/^File:/, "")).filter((t) => /\.(jpe?g|png|webp)$/i.test(t));
}

// Sample photos taken WITH the camera, keyword-dump file names (a church
// tagged "rx100 vii"), and shots of two cameras together.
// Also street-level captures (Mapillary), cutaways, launch slides and caps,
// all found among search hits by the 2026-10-17 review.
export const SAMPLE_SHOT = /\b(sample|taken|shot with|shot on|example|test ?shot|crop|100 ?%|photographed with|image quality|vs|mapillary|cutaway|presentation|cap of|lens cap|bokeh|montage)\b|[;&]| and /i;

// ------------------------------------------------------------- Openverse

export type OpenverseImage = { id: string; title: string; url: string; landing: string; creator: string; license: string; licenseVersion: string; licenseUrl: string; provider: string; tags: string[] };

/**
 * Openverse (WordPress's CC search: Flickr, Wikimedia and more). Commercial-
 * use licences only (CC0, PDM, BY, BY-SA). BY-ND is left out: Commons
 * refuses it, and a resized crop may count as an adaptation. Anonymous use
 * is 200 requests a day; OPENVERSE_TOKEN raises it.
 */
export async function openverseSearch(q: string): Promise<OpenverseImage[]> {
  const params = new URLSearchParams({ q, page_size: "20", license_type: "commercial", category: "photograph", mature: "false" });
  const token = process.env.OPENVERSE_TOKEN;
  const res = await fetch(`https://api.openverse.org/v1/images/?${params}`, { headers: { "User-Agent": USER_AGENT, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (res.status === 429) throw new Error("Openverse rate limit");
  if (!res.ok) throw new Error(`Openverse ${res.status}`);
  const body = (await res.json()) as { results: { id: string; title?: string; url: string; foreign_landing_url: string; creator?: string; license: string; license_version?: string; license_url?: string; provider: string; tags?: { name: string }[] }[] };
  return body.results
    .filter((r) => /^(cc0|pdm|by|by-sa)$/.test(r.license))
    .map((r) => ({
      id: r.id,
      title: r.title ?? "",
      url: r.url,
      landing: r.foreign_landing_url,
      creator: r.creator || "Unknown author",
      license: r.license === "cc0" ? "CC0" : r.license === "pdm" ? "Public domain" : `CC ${r.license.toUpperCase()} ${r.license_version ?? ""}`.trim(),
      licenseVersion: r.license_version ?? "",
      licenseUrl: r.license_url ?? "",
      provider: r.provider,
      tags: (r.tags ?? []).map((t) => t.name),
    }));
}
