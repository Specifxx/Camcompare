// "Just announced": the pure half (no fs, no network), so tests drive it and
// the client can import the types. scripts/fetch-releases.ts fetches, this
// parses, classifies, matches and merges; lib/releases/data.ts reads the file.
import { createHash } from "node:crypto";
import { z } from "zod";
import { tokens, type CatalogIndex, type Matchable, matchListing } from "../matching";

export const RELEASE_KINDS = ["video", "press"] as const;

export const releaseSchema = z
  .object({
    /** "r" + 12 hex of the item's URL: slug-safe, so it works as an alert's product and a comment target. */
    id: z.string().regex(/^r[0-9a-f]{12}$/),
    brand: z.string(),
    title: z.string().max(300),
    url: z.string().url(),
    publishedAt: z.string(),
    kind: z.enum(RELEASE_KINDS),
    videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/).optional(),
    /** Catalog slugs the title names. */
    products: z.array(z.string()),
    isAnnouncement: z.boolean(),
  })
  .strict();
export type Release = z.infer<typeof releaseSchema>;

export const releasesFileSchema = z.object({
  generatedAt: z.string().nullable(),
  /** Per feed: how the last run went ("youtube:UC…" or the RSS URL). */
  sources: z.record(z.object({ status: z.enum(["ok", "skipped", "error"]), items: z.number().int(), note: z.string().optional() })),
  releases: z.array(releaseSchema),
});
export type ReleasesFile = z.infer<typeof releasesFileSchema>;
export const emptyReleases = (): ReleasesFile => ({ generatedAt: null, sources: {}, releases: [] });

/** Announcements are kept this long; everything else (tutorials, ads) only RECENT_DAYS, so a heuristic miss can still be fixed but the file stays small. */
export const KEEP_DAYS = 183;
export const RECENT_DAYS = 21;

export const releaseId = (url: string) => `r${createHash("sha1").update(url).digest("hex").slice(0, 12)}`;
export const isReleaseId = (s: unknown): s is string => typeof s === "string" && /^r[0-9a-f]{12}$/.test(s);

// ---------------------------------------------------------------- feed parsing

export type FeedItem = { title: string; url: string; publishedAt: string; videoId?: string };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeXml(m[1]) : "";
};
const iso = (s: string) => {
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

/** A YouTube channel feed, an Atom feed or an RSS 2.0 feed → items. Tolerant: an item without a title, link or date is skipped. */
export function parseFeed(xml: string): FeedItem[] {
  const out: FeedItem[] = [];
  const atom = /<entry[\s>]/i.test(xml);
  const blocks = xml.match(atom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  for (const b of blocks) {
    const title = tag(b, "title") || tag(b, "media:title");
    let url = "";
    if (atom) {
      const alt = b.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) ?? b.match(/<link[^>]*href=["']([^"']+)["']/i);
      url = alt ? decodeXml(alt[1]) : "";
    } else url = tag(b, "link") || tag(b, "guid");
    const when = iso(tag(b, "published") || tag(b, "pubDate") || tag(b, "updated") || tag(b, "dc:date"));
    const videoId = tag(b, "yt:videoId") || undefined;
    if (!title || !/^https?:\/\//.test(url) || !when) continue;
    out.push({ title: title.slice(0, 300), url, publishedAt: when, ...(videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId) ? { videoId } : {}) });
  }
  return out;
}

/** The YouTube Data API's playlistItems.list answer (the channel's uploads playlist) → items. */
export function parseYoutubeApi(body: unknown): FeedItem[] {
  const items = (body as { items?: { snippet?: { title?: string; publishedAt?: string; resourceId?: { videoId?: string } } }[] })?.items ?? [];
  const out: FeedItem[] = [];
  for (const it of items) {
    const s = it.snippet;
    const id = s?.resourceId?.videoId;
    const when = s?.publishedAt ? iso(s.publishedAt) : null;
    if (!s?.title || !id || !/^[A-Za-z0-9_-]{11}$/.test(id) || !when || s.title === "Private video" || s.title === "Deleted video") continue;
    out.push({ title: s.title.slice(0, 300), url: `https://www.youtube.com/watch?v=${id}`, publishedAt: when, videoId: id });
  }
  return out;
}

// ---------------------------------------------------------------- classification

// What makes a title read as a launch, and what makes it something else. Tested
// in tests/releases.test.ts; a miss here only hides an item from the page (the
// file keeps it RECENT_DAYS), it never invents a product.
const LAUNCH = /\b(introduc(?:ing|es|ed)|announc(?:e|es|ed|ing|ement)|unveil(?:s|ed|ing)?|launch(?:es|ed|ing)?|release[sd]?|meet the|say hello|all[- ]new|brand[- ]new|new\b|now available|available now|pre-?orders?|coming soon|world premiere|debut(?:s)?|reveal(?:s|ed)?|official (?:trailer|launch|product video)|is here|arrives?|under development|in development|is developing)\b/i;
const NOT_LAUNCH = /\b(tutorial|how[- ]to|tips?|tricks?|webinar|live ?stream|livestream|firmware|software update|behind the scenes|bts|interview|masterclass|workshop|podcast|q ?& ?a|unboxing|episode|ep\.? ?\d|#shorts|recap|giveaway|contest|competition|winners?|sale|deal|discount|black friday|cyber monday|setup guide|getting started|explained|vs\.?|versus|review|hands[- ]on with|user story|customer story|case study|career|awards?|sponsor(?:ed|ship)?|anniversary of|esg|financial|earnings|results|program(?:me)?|partners?(?:hip)?|manufacturing|initiative|foundation|scholarship|grant|imageforce|imagerunner|imageprograf|pixma|maxify|copier|printers?|projectors?)\b/i;
/** A model-ish token: letters and digits together ("FX5", "X100VI", "Z6III", "R5", "a7"), or a focal length ("24-70mm", "35mm"). */
const MODEL = /\b(?=[a-z]*\d)(?=\d*[a-z])[a-z0-9]{2,10}\b|\b\d{1,3}(?:-\d{1,3})?\s?mm\b/i;

/**
 * Whether a feed item is an announcement worth a card: a launch word and no
 * "tutorial/webinar/firmware…" word. A title that names a catalog product, or
 * a model code, needs only the launch word; one that names neither needs a
 * strong one ("introducing", "announces", "pre-order", "launch").
 */
export function isAnnouncement(title: string, products: string[] = []): boolean {
  if (NOT_LAUNCH.test(title)) return false;
  if (!LAUNCH.test(title)) return false;
  if (products.length || MODEL.test(title)) return true;
  return /\b(introduc|announc|unveil|launch|pre-?order|world premiere|under development|is developing)/i.test(title);
}

// ---------------------------------------------------------------- products

/**
 * Catalog products a title names. First matchListing (with the maker's name
 * in front: channel titles often leave it out), which refuses accessories and
 * kits by the same rules as prices; then a name search over the catalog's
 * aliases for this brand, which can find more than one ("the A7 V and FE
 * 28-70mm"). Never loosens a match: only products of this release's brand.
 */
export function matchProducts(title: string, brandName: string, brandKey: string, index: CatalogIndex): string[] {
  const named = title.toLowerCase().includes(brandName.toLowerCase().split(/[ /(]/)[0]) ? title : `${brandName} ${title}`;
  const words = tokens(named);
  const hits: { p: Matchable; from: number; to: number }[] = [];
  for (let i = 0; i < words.length; i++) {
    let key = "";
    for (let j = i; j < Math.min(words.length, i + 8); j++) {
      key += words[j];
      if (key.length < 3) continue;
      for (const p of index.aliases.get(key) ?? []) if (p.brand === brandKey) hits.push({ p, from: i, to: j });
    }
  }
  // The longest name wins where two overlap ("a7c ii" over "a7c"). A name
  // followed by a generation or variant word is another model: "Osmo Pocket
  // 4P" is not the Osmo Pocket, "Z5II C" not the Z5II.
  const kept = hits.filter((h) => !hits.some((o) => o !== h && o.to - o.from > h.to - h.from && o.from <= h.from && o.to >= h.to));
  const otherModel = (h: (typeof hits)[number]) => {
    const next = words[h.to + 1] ?? "";
    return GENERATION_WORD.test(next) || (h.p.kind === "camera" && VARIANT_WORD.test(next));
  };
  const ok = new Set(kept.filter((h) => !otherModel(h)).map((h) => h.p.slug));
  const bad = new Set(kept.filter(otherModel).map((h) => h.p.slug));
  const found = new Set<string>();
  // matchListing first: it refuses accessories ("cage for the R6") and parts by the price import's rules.
  const m = matchListing({ title: named }, index);
  if (m.product && m.product.brand === brandKey && !bad.has(m.product.slug)) found.add(m.product.slug);
  else if (!m.product && /accessor|part|kit/.test(m.reason)) return [];
  for (const s of ok) found.add(s);
  return [...found].slice(0, 6);
}

const GENERATION_WORD = /^(?:ii|iii|iv|v|vi|vii|viii|ix|x)$/;
const VARIANT_WORD = /^(?:\d\w*|[a-z]|pro|plus|max|mini|lite|ultra|se|air|neo)$/;

// ---------------------------------------------------------------- merge

/**
 * This run's items into the file: new ones added, known ones refreshed (a
 * title can be edited; products re-matched as the catalog grows), old ones
 * dropped by age. Newest first. Pure.
 */
export function mergeReleases(prev: Release[], fresh: Release[], now: string): Release[] {
  const byId = new Map(prev.map((r) => [r.id, r]));
  for (const r of fresh) byId.set(r.id, r);
  const t = Date.parse(now);
  const keep = (r: Release) => {
    const age = (t - Date.parse(r.publishedAt)) / 86_400_000;
    return age <= (r.isAnnouncement ? KEEP_DAYS : RECENT_DAYS) && age > -2; // a date two days in the future is a feed's mistake
  };
  return [...byId.values()].filter(keep).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id));
}
