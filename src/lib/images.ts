// Camera thumbnails: static WebPs in public/cameras/, one per camera, with the
// photo's credit in data/image-credits.json. A camera without both is not
// published (lib/catalog/index.ts `publishedCameras`), and the build fails if
// a credit points at a missing file (tests/images.test.ts).
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

export const THUMB_WIDTH = 640;
const CREDITS_FILE = path.join(process.cwd(), "data", "image-credits.json");

export const imageCreditSchema = z.object({
  // "wikimedia-commons": a free-licence photo, credited as the licence asks.
  // "press": a maker's press image, used under its press-kit terms.
  source: z.enum(["wikimedia-commons", "press"]),
  file: z.string(),
  pageUrl: z.string().url(),
  author: z.string(),
  license: z.string(),
  licenseUrl: z.string().url().nullable(),
  wikidata: z.string().nullable(),
  width: z.number().int().positive(),
  height: z.number().int().nonnegative(),
});
export type ImageCredit = z.infer<typeof imageCreditSchema>;

export function readCredits(): Record<string, ImageCredit> {
  if (!fs.existsSync(CREDITS_FILE)) return {};
  return z.record(imageCreditSchema).parse(JSON.parse(fs.readFileSync(CREDITS_FILE, "utf8")));
}

export function writeCredits(credits: Record<string, ImageCredit>) {
  const sorted = Object.fromEntries(Object.entries(credits).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(CREDITS_FILE, JSON.stringify(sorted, null, 2) + "\n");
}

export const thumbPath = (slug: string) => path.join(process.cwd(), "public", "cameras", `${slug}.webp`);
export { thumbSrc } from "./thumb";
