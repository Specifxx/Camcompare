// Every published product needs a thumbnail (owner, 2026-10-17). For each
// camera or lens without one this tries, in order:
//   1. the photo on its Wikidata item (cameras and lenses both have items);
//   2. a Wikimedia Commons file whose NAME the listing matcher reads as this
//      product;
//   3. an Openverse (mostly Flickr) photo whose title it reads as this product.
// Free licences only. Writes public/products/<slug>.webp (640px wide, under
// 150 KB) and data/image-credits/<slug>.json. Candidates a reviewer rejected
// (data/image-rejects/<slug>.json) are never picked again.
//
// Anything found by search (2 or 3) must be looked at before it ships:
// `npm run thumbs:sheet -- <slugs>` draws a labelled contact sheet.
//
//   npm run thumbs:fetch                      every product missing a thumbnail
//   ONLY=slug,slug npm run thumbs:fetch       just these
//   FORCE=1 …                                 refetch even if present
//   SOURCES=wikidata,commons,openverse …      limit the sources
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { readCameraFiles, readLensFiles } from "../src/lib/catalog/load";
import { readCredits, readRejects, thumbPath, THUMB_MAX_BYTES, THUMB_WIDTH, writeCredit, type ImageCredit } from "../src/lib/images";
import { buildIndex, matchListing } from "../src/lib/matching";
import { SAMPLE_SHOT, USER_AGENT, commonsImage, fetchWikidataCameras, linkAll, openverseSearch, searchCommonsFiles } from "../src/lib/wikidata";

type Candidate = { url: string; credit: Omit<ImageCredit, "width" | "height">; via: "wikidata" | "commons" | "openverse" };

async function toWebp(url: string): Promise<Buffer | null> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return null;
  const input = Buffer.from(await res.arrayBuffer());
  let quality = 78;
  let webp: Buffer;
  do {
    webp = await sharp(input).rotate().resize({ width: THUMB_WIDTH, withoutEnlargement: true }).webp({ quality }).toBuffer();
    quality -= 8;
  } while (webp.length > THUMB_MAX_BYTES && quality > 30);
  return webp;
}

async function main() {
  const { cameras } = readCameraFiles();
  const { lenses } = readLensFiles();
  const only = process.env.ONLY?.split(",").filter(Boolean);
  const sources = new Set((process.env.SOURCES ?? "wikidata,commons,openverse").split(","));
  const credits = readCredits();
  const index = buildIndex(cameras, lenses);
  const products = [...cameras.map((p) => ({ kind: "camera" as const, p })), ...lenses.map((p) => ({ kind: "lens" as const, p }))].filter(
    ({ p }) => (!only || only.includes(p.slug)) && (process.env.FORCE || !credits[p.slug] || !fs.existsSync(thumbPath(p.slug))),
  );
  console.log(`${products.length} products need a thumbnail`);
  if (!products.length) return;

  const links = new Map<string, Awaited<ReturnType<typeof fetchWikidataCameras>>[number]>();
  if (sources.has("wikidata")) {
    for (const kind of ["camera", "lens"] as const) {
      const items = await fetchWikidataCameras(kind);
      const list = kind === "camera" ? cameras : lenses;
      for (const [slug, w] of linkAll(list, items)) links.set(slug, w);
      console.log(`${items.length} Wikidata ${kind} items, ${[...links.keys()].length} linked so far`);
    }
  }

  const missing: string[] = [];
  const byKind: Record<string, string[]> = { wikidata: [], commons: [], openverse: [] };
  let openverseOff = !sources.has("openverse");
  for (const { kind, p } of products) {
    const rejected = new Set(readRejects(p.slug));
    const isThis = (title: string) => !SAMPLE_SHOT.test(title) && matchListing({ title }, index, kind).product?.slug === p.slug;
    const tried: string[] = [];
    let cand: Candidate | null = null;

    const w = links.get(p.slug);
    if (w?.image && !rejected.has(w.image)) {
      const img = await commonsImage(w.image);
      if (img) cand = { url: img.thumbUrl, via: "wikidata", credit: { source: "wikimedia-commons", provider: "wikimedia", file: img.file, pageUrl: img.pageUrl, author: img.author, license: img.license, licenseUrl: img.licenseUrl, wikidata: w.qid } };
      else tried.push(`${w.image}: not free`);
    } else tried.push(w ? `${w.qid} has no image` : "no Wikidata item");

    if (!cand && sources.has("commons")) {
      for (const name of await searchCommonsFiles(`${p.name.replace(/α/g, "a")}`)) {
        if (rejected.has(name) || !isThis(name.replace(/\.[a-z]+$/i, ""))) continue;
        const img = await commonsImage(name);
        if (!img) continue;
        cand = { url: img.thumbUrl, via: "commons", credit: { source: "wikimedia-commons", provider: "wikimedia", file: img.file, pageUrl: img.pageUrl, author: img.author, license: img.license, licenseUrl: img.licenseUrl, wikidata: w?.qid ?? null } };
        break;
      }
      if (!cand) tried.push("no Commons file named for it");
    }

    if (!cand && !openverseOff) {
      try {
        const hits = await openverseSearch(p.name.replace(/α/g, "a"));
        const hit = hits.find((h) => !rejected.has(h.url) && h.title && isThis(h.title));
        if (hit) cand = { url: hit.url, via: "openverse", credit: { source: "openverse", provider: hit.provider, file: hit.url, pageUrl: hit.landing, author: hit.creator, license: hit.license, licenseUrl: hit.licenseUrl || null, wikidata: w?.qid ?? null } };
        else tried.push("no Openverse photo titled for it");
        await new Promise((r) => setTimeout(r, 3200)); // 20 a minute
      } catch (e) {
        console.log(`Openverse off for this run: ${(e as Error).message}`);
        openverseOff = true;
      }
    }

    if (!cand) {
      missing.push(`${p.slug} (${tried.join("; ")})`);
      continue;
    }
    const webp = await toWebp(cand.url);
    if (!webp) {
      missing.push(`${p.slug} (download failed)`);
      continue;
    }
    fs.mkdirSync(path.dirname(thumbPath(p.slug)), { recursive: true });
    fs.writeFileSync(thumbPath(p.slug), webp);
    const meta = await sharp(webp).metadata();
    writeCredit(p.slug, { ...cand.credit, width: meta.width ?? THUMB_WIDTH, height: meta.height ?? 0 });
    byKind[cand.via].push(p.slug);
    console.log(`${p.slug}: ${cand.via} ${cand.credit.license} (${Math.round(webp.length / 1024)} KB)`);
  }
  console.log(`\nFrom Wikidata ${byKind.wikidata.length}, Commons search ${byKind.commons.length}, Openverse ${byKind.openverse.length}`);
  const review = [...byKind.commons, ...byKind.openverse];
  if (review.length) console.log(`Review these by eye (npm run thumbs:sheet -- ${review.join(",")})`);
  if (missing.length) console.log(`\nNo thumbnail for ${missing.length}:\n  ${missing.join("\n  ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
