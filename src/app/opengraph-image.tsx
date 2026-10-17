// The link preview (Reddit, X, Slack, iMessage): built at each build from the
// live catalog and today's offers, so the prices in it are real.
import fs from "node:fs";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { offersFor, product, publishedCameras, publishedLenses, displayShortName } from "@/lib/catalog";
import { price } from "@/lib/format";
import { MARKET_CODES } from "@/lib/markets";
import { lowest, type Offer } from "@/lib/offers";
import { retailer } from "@/lib/retailers";
import { thumbPath } from "@/lib/images";

export const alt = "CamCompare: camera and lens prices from every store, side by side";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const IRIS = [
  ["M21.65 14.59L30.53 19.71A15 15 0 0 1 21.65 29.9Z", "#1d47d1"],
  ["M20.05 20.19L20.05 30.44A15 15 0 0 1 6.79 27.84Z", "#2557e6"],
  ["M14.4 21.6L5.52 26.73A15 15 0 0 1 1.14 13.95Z", "#3169f5"],
  ["M10.35 17.41L1.47 12.29A15 15 0 0 1 10.35 2.1Z", "#4a82ff"],
  ["M11.95 11.81L11.95 1.56A15 15 0 0 1 25.21 4.16Z", "#3a74ff"],
  ["M17.6 10.4L26.48 5.27A15 15 0 0 1 30.86 18.05Z", "#ff9f1c"],
];

/** Bold display type (Inter from Google Fonts); the default font if offline. */
async function font(weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Inter:wght@${weight}`, { headers: { "User-Agent": "Mozilla/4.0" } })).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype|woff)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

async function png(slug: string, w: number): Promise<string | null> {
  const file = thumbPath(slug);
  if (!fs.existsSync(file)) return null;
  const buf = await sharp(file).resize({ width: w, height: Math.round(w * 0.75), fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toBuffer();
  return `data:image/png;base64,${buf.toString("base64")}`;
}

/** The US camera with the most stores pricing it today: the hero of the card. */
function hero() {
  let best: { slug: string; rows: Offer[] } | null = null;
  for (const c of publishedCameras()) {
    const rows = offersFor(c.slug, "us").filter((o) => o.condition === "new" && o.inStock && !o.kit && !retailer(o.retailer)?.amazon);
    const byStore = new Map<string, Offer>();
    for (const o of rows) if (!byStore.has(o.retailer) || o.price < byStore.get(o.retailer)!.price) byStore.set(o.retailer, o);
    const list = [...byStore.values()].sort((a, b) => a.price - b.price);
    if (!best || list.length > best.rows.length) best = { slug: c.slug, rows: list };
  }
  return best;
}

export default async function Image() {
  const h = hero();
  const p = h ? product(h.slug) : null;
  const rows = h?.rows.slice(0, 3) ?? [];
  const photo = h ? await png(h.slug, 420) : null;
  const products = publishedCameras().length + publishedLenses().length;
  // Stores with at least one price today, in any market.
  const live = new Set<string>();
  for (const m of MARKET_CODES) for (const x of [...publishedCameras(), ...publishedLenses()]) for (const o of offersFor(x.slug, m)) live.add(o.retailer);
  const stores = live.size;
  const [bold, black] = await Promise.all([font(700), font(800)]);
  const used = MARKET_CODES.reduce((n, m) => n + publishedCameras().filter((c) => lowest(offersFor(c.slug, m), "used")).length, 0);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "linear-gradient(135deg, #071027 0%, #0d1f4d 55%, #112a6b 100%)", color: "#fff", position: "relative", fontFamily: "Inter, sans-serif" }}>
        <div style={{ position: "absolute", top: -160, right: -120, width: 620, height: 620, borderRadius: 9999, background: "radial-gradient(circle, rgba(74,130,255,0.55), rgba(74,130,255,0) 70%)", display: "flex" }} />
        <div style={{ position: "absolute", bottom: -220, left: 220, width: 560, height: 560, borderRadius: 9999, background: "radial-gradient(circle, rgba(255,159,28,0.35), rgba(255,159,28,0) 70%)", display: "flex" }} />

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 0 56px 64px", width: 640 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg width="64" height="64" viewBox="0 0 32 32">
              {IRIS.map(([d, fill]) => (
                <path key={d} d={d} fill={fill} />
              ))}
            </svg>
            <div style={{ display: "flex", fontSize: 44, fontWeight: 700, letterSpacing: -1.5 }}>
              Cam<span style={{ color: "#9db6ff" }}>Compare</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 60, fontWeight: 800, lineHeight: 1.04, letterSpacing: -2.5 }}>Every camera price,</div>
            <div style={{ display: "flex", fontSize: 60, fontWeight: 800, lineHeight: 1.04, letterSpacing: -2.5, color: "#ffb03a" }}>side by side.</div>
            <div style={{ marginTop: 22, fontSize: 26, color: "#c7d4ff", lineHeight: 1.35, display: "flex" }}>{`New and used prices from ${stores} stores, full specs and price history. Free.`}</div>
          </div>
          <div style={{ display: "flex", gap: 14 }}>
            {[`${products} products`, `${stores} stores`, "US · UK · EU · AU · SG"].map((t) => (
              <div key={t} style={{ display: "flex", padding: "8px 16px", borderRadius: 9999, border: "1.5px solid rgba(157,182,255,0.45)", background: "rgba(255,255,255,0.06)", fontSize: 20, fontWeight: 700, color: "#e3e9ff", whiteSpace: "nowrap" }}>
                {t}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: 560, padding: "0 56px 0 24px" }}>
          <div style={{ display: "flex", flexDirection: "column", background: "#ffffff", borderRadius: 28, padding: 26, color: "#0b1530", boxShadow: "0 30px 80px rgba(0,0,0,0.45)", transform: "rotate(-2deg)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- satori renders plain <img> only */}
            {photo && <img alt="" src={photo} width={420} height={250} style={{ objectFit: "contain", alignSelf: "center" }} />}
            <div style={{ display: "flex", fontSize: 28, fontWeight: 800, marginTop: 6 }}>{p ? displayShortName(p.item, "us") : "Compare every store"}</div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 12, gap: 8 }}>
              {rows.map((o, i) => (
                <div key={o.retailer} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 14, background: i === 0 ? "#e8f8ee" : "#f2f4fa", fontSize: 22 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontWeight: 700 }}>{retailer(o.retailer)?.name ?? o.retailer}</span>
                    {i === 0 && <span style={{ fontSize: 15, fontWeight: 800, color: "#fff", background: "#16a34a", borderRadius: 9999, padding: "3px 10px" }}>LOWEST</span>}
                  </div>
                  <span style={{ fontWeight: 800, color: i === 0 ? "#15803d" : "#0b1530" }}>{price(o.price, o.currency)}</span>
                </div>
              ))}
            </div>
            {used > 0 && <div style={{ display: "flex", marginTop: 12, fontSize: 17, color: "#5b6b8f" }}>{`+ used prices on ${used} camera pages today`}</div>}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        ...(bold ? [{ name: "Inter", data: bold, weight: 700 as const, style: "normal" as const }] : []),
        ...(black ? [{ name: "Inter", data: black, weight: 800 as const, style: "normal" as const }] : []),
      ],
    },
  );
}
