// A post's thumbnail: its link preview, and the picture on its card on the home
// page and /guides. Drawn at build from the post's own products (licensed
// photos only, the files in public/products), so it never shows a stranger's
// camera; a post with none gets the title on its own.
import fs from "node:fs";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { postSlugs } from "@/lib/guide-blocks";
import { guide, guides } from "@/lib/guides";
import { thumbPath } from "@/lib/images";

export const alt = "CamCompare blog";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamicParams = false;
export const generateStaticParams = () => guides().map((g) => ({ slug: g.slug }));

const IRIS = [
  ["M21.65 14.59L30.53 19.71A15 15 0 0 1 21.65 29.9Z", "#1d47d1"],
  ["M20.05 20.19L20.05 30.44A15 15 0 0 1 6.79 27.84Z", "#2557e6"],
  ["M14.4 21.6L5.52 26.73A15 15 0 0 1 1.14 13.95Z", "#3169f5"],
  ["M10.35 17.41L1.47 12.29A15 15 0 0 1 10.35 2.1Z", "#4a82ff"],
  ["M11.95 11.81L11.95 1.56A15 15 0 0 1 25.21 4.16Z", "#3a74ff"],
  ["M17.6 10.4L26.48 5.27A15 15 0 0 1 30.86 18.05Z", "#16a34a"],
];

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

export default async function Image({ params }: { params: { slug: string } }) {
  const g = guide(params.slug);
  const title = g?.title ?? "CamCompare";
  const photos = (await Promise.all((g ? postSlugs(g) : []).filter((s) => fs.existsSync(thumbPath(s))).slice(0, 3).map((s) => png(s, 360)))).filter((x): x is string => x !== null);
  const [bold, black] = await Promise.all([font(700), font(800)]);
  const kicker = g?.kind === "blog" ? "CAMCOMPARE BLOG · LIVE PRICES" : "CAMCOMPARE GUIDE";
  const titleSize = title.length > 70 ? 52 : title.length > 45 ? 60 : 68;
  // Fanned cards: the first in front, slightly bigger; up to three.
  const place = [
    { left: 130, top: 160, rot: -3, w: 360, z: 3 },
    { left: 10, top: 50, rot: -9, w: 280, z: 1 },
    { left: 225, top: 40, rot: 7, w: 280, z: 2 },
  ];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "linear-gradient(135deg, #071027 0%, #0d1f4d 55%, #112a6b 100%)", color: "#fff", position: "relative", fontFamily: "Inter, sans-serif" }}>
        <div style={{ position: "absolute", top: -160, right: -120, width: 620, height: 620, borderRadius: 9999, background: "radial-gradient(circle, rgba(74,130,255,0.55), rgba(74,130,255,0) 70%)", display: "flex" }} />
        <div style={{ position: "absolute", bottom: -220, left: 160, width: 560, height: 560, borderRadius: 9999, background: "radial-gradient(circle, rgba(34,197,94,0.28), rgba(34,197,94,0) 70%)", display: "flex" }} />

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "52px 0 52px 64px", width: photos.length ? 640 : 1072 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <svg width="52" height="52" viewBox="0 0 32 32">
              {IRIS.map(([d, fill]) => (
                <path key={d} d={d} fill={fill} />
              ))}
            </svg>
            <div style={{ display: "flex", fontSize: 36, fontWeight: 700, letterSpacing: -1.2 }}>
              Cam<span style={{ color: "#9db6ff" }}>Compare</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 20, fontWeight: 800, letterSpacing: 2, color: "#4ade80" }}>{kicker}</div>
            <div style={{ display: "flex", marginTop: 14, fontSize: titleSize, fontWeight: 800, lineHeight: 1.06, letterSpacing: -2 }}>{title}</div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {["Today's prices", "Makers' specs", "US · UK · EU · AU · SG"].map((t) => (
              <div key={t} style={{ display: "flex", padding: "7px 15px", borderRadius: 9999, border: "1.5px solid rgba(157,182,255,0.45)", background: "rgba(255,255,255,0.06)", fontSize: 19, fontWeight: 700, color: "#e3e9ff", whiteSpace: "nowrap" }}>
                {t}
              </div>
            ))}
          </div>
        </div>

        {photos.length === 0 && (
          <svg width="420" height="420" viewBox="0 0 32 32" style={{ position: "absolute", right: -60, bottom: -70, opacity: 0.22 }}>
            {IRIS.map(([d, fill]) => (
              <path key={d} d={d} fill={fill} />
            ))}
          </svg>
        )}
        {photos.length > 0 && (
          <div style={{ display: "flex", position: "relative", width: 560, height: 630 }}>
            {/* Drawn back to front: the first photo ends up on top. */}
            {[...photos.keys()].reverse().map((i) => {
              const src = photos[i];
              const p = photos.length === 1 ? { left: 60, top: 150, rot: -3, w: 420, z: 3 } : place[i];
              return (
                <div key={i} style={{ position: "absolute", left: p.left, top: p.top + (photos.length === 2 && i === 0 ? 60 : 0), display: "flex", background: "#fff", borderRadius: 24, padding: 14, transform: `rotate(${p.rot}deg)`, boxShadow: "0 30px 70px rgba(0,0,0,0.5)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- satori renders plain <img> only */}
                  <img alt="" src={src} width={p.w} height={Math.round(p.w * 0.75)} style={{ objectFit: "contain" }} />
                </div>
              );
            })}
          </div>
        )}
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
