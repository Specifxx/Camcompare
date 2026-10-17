import type { Metadata } from "next";
import CameraBrowser from "@/components/CameraBrowser";
import { brands, publishedCameras } from "@/lib/catalog";

import { summarize } from "@/lib/summary";


export const metadata: Metadata = {
  title: "All cameras: filter by sensor, budget and features",
  description: "Every mirrorless, DSLR and premium compact camera we track, filterable by brand, sensor size, price and features.",
  alternates: { canonical: "/cameras" },
};

export default function CamerasPage() {
  const cameras = publishedCameras();
  const live = brands().filter((b) => cameras.some((c) => c.brand === b.slug)).map((b) => ({ slug: b.slug, name: b.name }));
  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight">Cameras</h1>
      <p className="mb-6 text-sm text-muted">Tick up to four cameras to compare them side by side.</p>
      <CameraBrowser cameras={cameras.map(summarize)} brands={live} />
    </div>
  );
}
