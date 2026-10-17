// A labelled contact sheet of product thumbnails, for checking by eye that
// each photo really shows that product (not a sample shot, not two cameras,
// not the wrong generation).
//   npm run thumbs:sheet -- slug1,slug2,…   [OUT=/path/sheet.png]
// With no slugs: every thumbnail, 64 per sheet (OUT gets -0, -1… suffixes).
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { thumbPath } from "../src/lib/images";

const W = 220;
const H = 190;
const COLS = 8;
const PER_SHEET = 64;

async function sheet(slugs: string[], out: string) {
  const tiles = await Promise.all(
    slugs.map(async (s) => {
      const img = fs.existsSync(thumbPath(s))
        ? await sharp(thumbPath(s)).resize(W, H - 22, { fit: "contain", background: "#ffffff" }).png().toBuffer()
        : await sharp({ create: { width: W, height: H - 22, channels: 3, background: "#ffdddd" } }).png().toBuffer();
      const label = Buffer.from(`<svg width="${W}" height="22"><rect width="${W}" height="22" fill="#000"/><text x="3" y="15" font-size="11" fill="#fff" font-family="sans-serif">${s.slice(0, 34)}</text></svg>`);
      return sharp({ create: { width: W, height: H, channels: 3, background: "#ffffff" } }).composite([{ input: img, top: 0, left: 0 }, { input: label, top: H - 22, left: 0 }]).png().toBuffer();
    }),
  );
  await sharp({ create: { width: W * COLS, height: H * Math.ceil(slugs.length / COLS), channels: 3, background: "#ffffff" } })
    .composite(tiles.map((t, i) => ({ input: t, left: (i % COLS) * W, top: Math.floor(i / COLS) * H })))
    .png()
    .toFile(out);
  console.log(out);
}

async function main() {
  const arg = process.argv[2];
  const all = arg ? arg.split(",").filter(Boolean) : fs.readdirSync(path.join(process.cwd(), "public", "products")).filter((f) => f.endsWith(".webp")).map((f) => f.slice(0, -5)).sort();
  const out = process.env.OUT ?? path.join(process.cwd(), "thumb-sheet.png");
  if (all.length <= PER_SHEET) return sheet(all, out);
  for (let i = 0; i * PER_SHEET < all.length; i++) await sheet(all.slice(i * PER_SHEET, (i + 1) * PER_SHEET), out.replace(/\.png$/, `-${i}.png`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
