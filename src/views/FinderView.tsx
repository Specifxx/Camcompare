import type { Metadata } from "next";
import Finder from "@/components/Finder";
import { publishedCameras } from "@/lib/catalog";
import { MARKETS, type MarketCode } from "@/lib/markets";
import { pageMeta } from "@/lib/seo";
import { summarizeCamera } from "@/lib/summary";

export function finderMetadata(m: MarketCode): Metadata {
  return pageMeta({ title: "Camera finder: which camera should I buy?", description: `Answer three questions and get cameras that fit how you shoot and your budget in ${MARKETS[m].name}, with the specs behind every pick.`, path: "/finder", market: m });
}

export default function FinderView({ market: m }: { market: MarketCode }) {
  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Which camera should you buy?</h1>
      <p className="mb-8 mt-1 max-w-2xl text-sm text-muted">Three questions. Every suggestion shows the specs that earned it a place, and prices are for {MARKETS[m].name}.</p>
      <Finder cameras={publishedCameras().filter((c) => c.status === "current" || c.announced >= "2019").map((c) => summarizeCamera(c, m))} market={m} />
    </div>
  );
}
