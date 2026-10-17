// Product thumbnails: static WebPs in public/products/<slug>.webp, one per
// camera or lens, with the photo's credit in data/image-credits/<slug>.json
// (one file per product, so parallel thumbnail runs never collide). A
// product without both is not published (lib/catalog/index.ts), and
// tests/catalog.test.ts fails if a credit has no file or a file no credit.
// Rejected candidates live in data/image-rejects/<slug>.json so a later run
// never picks them again.
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

export const THUMB_WIDTH = 640;
export const THUMB_MAX_BYTES = 150_000;
const CREDITS_DIR = path.join(process.cwd(), "data", "image-credits");
const REJECTS_DIR = path.join(process.cwd(), "data", "image-rejects");

export const imageCreditSchema = z
  .object({
    // "wikimedia-commons": a free-licence photo found through Wikidata/Commons.
    // "openverse": a free-licence photo found through Openverse (mostly Flickr).
    // "press": a maker's press image, used under its press-kit terms.
    source: z.enum(["wikimedia-commons", "openverse", "press"]),
    provider: z.string(), // "wikimedia", "flickr", the maker…
    file: z.string(), // file title or original URL
    pageUrl: z.string().url(),
    author: z.string(),
    license: z.string(), // "CC BY-SA 4.0", "CC0", "Press image"
    licenseUrl: z.string().url().nullable(),
    wikidata: z.string().nullable(),
    width: z.number().int().positive(),
    height: z.number().int().nonnegative(),
  })
  .strict();
export type ImageCredit = z.infer<typeof imageCreditSchema>;

export function readCredits(): Record<string, ImageCredit> {
  if (!fs.existsSync(CREDITS_DIR)) return {};
  const out: Record<string, ImageCredit> = {};
  for (const f of fs.readdirSync(CREDITS_DIR).filter((x) => x.endsWith(".json")).sort()) {
    out[f.slice(0, -5)] = imageCreditSchema.parse(JSON.parse(fs.readFileSync(path.join(CREDITS_DIR, f), "utf8")));
  }
  return out;
}

export function writeCredit(slug: string, credit: ImageCredit) {
  fs.mkdirSync(CREDITS_DIR, { recursive: true });
  fs.writeFileSync(path.join(CREDITS_DIR, `${slug}.json`), JSON.stringify(imageCreditSchema.parse(credit), null, 2) + "\n");
}

export function removeThumb(slug: string) {
  for (const p of [thumbPath(slug), path.join(CREDITS_DIR, `${slug}.json`)]) if (fs.existsSync(p)) fs.unlinkSync(p);
}

/**
 * The keys a photo is known by: its file title or URL, plus its Flickr photo
 * id when it has one. Commons keeps that id in the title of a Flickr import
 * ("… (52546794891).jpg", "(51084105452, cropped)"), Openverse in the image
 * and landing URLs, so a rejected photo is known again whichever way it
 * comes back.
 */
export function photoKeys(fileOrUrl: string): string[] {
  const flickr =
    fileOrUrl.match(/\((\d{9,11})(?:,[^)]*)?\)/)?.[1] ?? fileOrUrl.match(/staticflickr\.com\/\d+\/(\d+)_/)?.[1] ?? fileOrUrl.match(/flickr\.com\/photos\/[^/]+\/(\d+)/)?.[1];
  return flickr ? [fileOrUrl, `flickr:${flickr}`] : [fileOrUrl];
}

export function readRejects(slug: string): string[] {
  const p = path.join(REJECTS_DIR, `${slug}.json`);
  return fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf8")) as { files: string[] }).files : [];
}

export function addReject(slug: string, file: string) {
  const files = [...new Set([...readRejects(slug), file])];
  fs.mkdirSync(REJECTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(REJECTS_DIR, `${slug}.json`), JSON.stringify({ files }, null, 2) + "\n");
}

export const THUMBS_DIR = path.join(process.cwd(), "public", "products");
export const thumbPath = (slug: string) => path.join(THUMBS_DIR, `${slug}.webp`);
export { thumbSrc } from "./thumb";
