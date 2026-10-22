// A product page's photo gallery. The first photo is always the product's
// thumbnail (public/products/<slug>.webp, credit in data/image-credits/).
// More photos can be added later, ONLY licensed ones with a credit, as
// data/gallery/<slug>.json: a list of { src: "/products/gallery/<file>.webp",
// alt, ...the same credit fields as data/image-credits }. No such file exists
// yet (2026-10-22), so every gallery is one photo today. Never a photo found
// by search without its licence (docs/images.md).
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { credit, storePhoto } from "./catalog";
import { imageCreditSchema, type ImageCredit } from "./images";
import { thumbSrc } from "./thumb";

/** `store`: the photo is that store's own listing photo (no licensed one yet), credited "Image: <store>". */
export type GalleryImage = { src: string; alt: string; credit: ImageCredit | null; store?: string };

const extraSchema = z.array(imageCreditSchema.extend({ src: z.string().regex(/^\/products\/gallery\/[a-z0-9-]+\.(webp|jpg|png)$/), alt: z.string().min(2) }).strict()).max(12);
const DIR = path.join(process.cwd(), "data", "gallery");

export function galleryFor(slug: string, alt: string): GalleryImage[] {
  const sp = credit(slug) ? null : storePhoto(slug);
  const out: GalleryImage[] = [{ src: thumbSrc(slug), alt, credit: credit(slug), ...(sp ? { store: sp.store } : {}) }];
  const f = path.join(DIR, `${slug}.json`);
  if (!fs.existsSync(f)) return out;
  for (const x of extraSchema.parse(JSON.parse(fs.readFileSync(f, "utf8")))) {
    const { src, alt: a, ...c } = x;
    out.push({ src, alt: a, credit: c });
  }
  return out;
}
