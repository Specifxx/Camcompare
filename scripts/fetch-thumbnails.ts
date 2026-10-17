// Every published camera needs a thumbnail (owner, 2026-10-17). This finds
// each camera's freely licensed Commons photo through Wikidata, writes
// public/cameras/<slug>.webp (640px wide, under the 150 KB image budget) and
// records author + licence in data/image-credits.json, which the camera page
// prints under the photo (CC BY / BY-SA require attribution).
//
// Cameras with no free photo are listed at the end. They stay out of every
// listing until one is added — see docs/images.md for the manual route.
//
//   npm run thumbs:fetch            fetch missing thumbnails
//   FORCE=1 npm run thumbs:fetch    refetch all
//   ONLY=sony-a7-iv,... npm run thumbs:fetch
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { readCameraFiles } from "../src/lib/catalog/load";
import { readCredits, writeCredits, thumbPath, THUMB_WIDTH, type ImageCredit } from "../src/lib/images";
import { buildIndex, matchListing } from "../src/lib/matching";
import { SAMPLE_SHOT, USER_AGENT, commonsImage, fetchWikidataCameras, linkAll, searchCommonsFiles } from "../src/lib/wikidata";

const MAX_BYTES = 150_000;

async function main() {
  const { cameras } = readCameraFiles();
  const only = process.env.ONLY?.split(",").filter(Boolean);
  const credits = readCredits();
  const items = await fetchWikidataCameras();
  console.log(`${items.length} Wikidata camera items`);
  const index = buildIndex(cameras);
  const links = linkAll(cameras, items);
  const missing: string[] = [];
  const fromSearch: string[] = [];
  for (const camera of cameras) {
    if (only && !only.includes(camera.slug)) continue;
    const out = thumbPath(camera.slug);
    if (!process.env.FORCE && fs.existsSync(out) && credits[camera.slug]) continue;
    const item = links.get(camera.slug) ?? null;
    let file = item?.image ?? null;
    let why = item ? `${item.qid} has no image` : "no Wikidata match";
    if (!file) {
      // Fallback: a Commons file whose NAME is unmistakably this camera.
      const names = await searchCommonsFiles(`${camera.name.replace(/α/g, "a")} camera`);
      file = names.find((n) => !SAMPLE_SHOT.test(n) && matchListing({ title: n.replace(/\.[a-z]+$/i, "") }, index).camera?.slug === camera.slug) ?? null;
      if (file) fromSearch.push(camera.slug);
      else why += ", no Commons file named for it";
    }
    if (!file) {
      missing.push(`${camera.slug} (${why})`);
      continue;
    }
    const img = await commonsImage(file);
    if (!img) {
      missing.push(`${camera.slug} (${file}: not freely licensed)`);
      continue;
    }
    const res = await fetch(img.thumbUrl, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) {
      missing.push(`${camera.slug} (download ${res.status})`);
      continue;
    }
    const input = Buffer.from(await res.arrayBuffer());
    let quality = 78;
    let webp: Buffer;
    do {
      webp = await sharp(input).rotate().resize({ width: THUMB_WIDTH, withoutEnlargement: true }).webp({ quality }).toBuffer();
      quality -= 8;
    } while (webp.length > MAX_BYTES && quality > 30);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, webp);
    const meta = await sharp(webp).metadata();
    const credit: ImageCredit = {
      source: "wikimedia-commons",
      file: img.file,
      pageUrl: img.pageUrl,
      author: img.author,
      license: img.license,
      licenseUrl: img.licenseUrl,
      wikidata: item?.qid ?? null,
      width: meta.width ?? THUMB_WIDTH,
      height: meta.height ?? 0,
    };
    credits[camera.slug] = credit;
    writeCredits(credits);
    console.log(`${camera.slug}: ${img.file} (${img.license}, ${Math.round(webp.length / 1024)} KB)`);
    await new Promise((r) => setTimeout(r, 500));
  }
  if (fromSearch.length) console.log(`\nFound by Commons search (check these by eye): ${fromSearch.join(", ")}`);
  if (missing.length) console.log(`\nNo thumbnail for ${missing.length}:\n  ${missing.join("\n  ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
