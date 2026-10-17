import type { Metadata } from "next";
import AdSlot from "@/components/AdSlot";
import { AD_SLOTS } from "@/lib/ads";
import Browser from "@/components/Browser";
import { brands, mounts, publishedCameras, publishedLenses } from "@/lib/catalog";
import { itemListLd, ldJson } from "@/lib/jsonld";
import { MARKETS, marketPath, type MarketCode } from "@/lib/markets";
import { pageMeta } from "@/lib/seo";
import { summarizeCamera, summarizeLens } from "@/lib/summary";

export function browseMetadata(kind: "camera" | "lens", m: MarketCode): Metadata {
  return kind === "camera"
    ? pageMeta({ title: "All cameras: filter by sensor, budget and features", description: `Every mirrorless, DSLR, compact, action and cinema camera we track, with today's lowest prices in ${MARKETS[m].name}.`, path: "/cameras", market: m })
    : pageMeta({ title: "All lenses: filter by mount, focal length and aperture", description: `Lenses for every major mount, from the makers and from Sigma, Tamron, Samyang, Viltrox and more, with prices in ${MARKETS[m].name}.`, path: "/lenses", market: m });
}

export default function BrowseView({ kind, market: m }: { kind: "camera" | "lens"; market: MarketCode }) {
  const list = kind === "camera" ? publishedCameras() : publishedLenses();
  const used = new Set(list.map((p) => p.brand));
  const brandOpts = brands().filter((b) => used.has(b.slug)).map((b): [string, string] => [b.slug, b.name]);
  const mountSlugs = new Set(kind === "camera" ? publishedCameras().map((c) => c.mount).filter(Boolean) : publishedLenses().flatMap((l) => l.mounts));
  const mountOpts = mounts().filter((mt) => mountSlugs.has(mt.slug)).map((mt): [string, string] => [mt.slug, mt.name]);
  const path = kind === "camera" ? "/cameras" : "/lenses";
  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(itemListLd(list.map((p) => ({ name: p.name, path: marketPath(m, `${path}/${p.slug}`) }))))} />
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight">{kind === "camera" ? "Cameras" : "Lenses"}</h1>
      <p className="mb-6 text-sm text-muted">
        {list.length} {kind === "camera" ? "cameras" : "lenses"}, prices for {MARKETS[m].name}. Tick up to four to compare them side by side.
      </p>
      {kind === "camera" ? (
        <Browser kind="camera" items={publishedCameras().map((c) => summarizeCamera(c, m))} brands={brandOpts} mounts={mountOpts} market={m} />
      ) : (
        <Browser kind="lens" items={publishedLenses().map((l) => summarizeLens(l, m))} brands={brandOpts} mounts={mountOpts} market={m} />
      )}
      <AdSlot slot={AD_SLOTS.listing} />
    </div>
  );
}
