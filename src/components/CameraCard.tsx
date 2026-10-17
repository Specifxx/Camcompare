import Link from "next/link";
import type { CameraSummary } from "@/lib/summary";
import { centsToUsd, usdWhole, year } from "@/lib/format";
import { sensorLabel } from "@/lib/specs/definitions";
import CameraThumb from "./CameraThumb";

export default function CameraCard({ c }: { c: CameraSummary }) {
  const price = c.lowestNewCents ?? c.lowestUsedCents;
  return (
    <Link href={`/cameras/${c.slug}`} className="card group flex flex-col gap-2 p-3 text-fg no-underline hover:border-accent hover:no-underline">
      <CameraThumb slug={c.slug} alt={c.name} />
      <div className="flex-1">
        <p className="text-xs font-medium text-subtle">{c.brandName}</p>
        <p className="font-semibold leading-tight group-hover:text-accent">{c.shortName}</p>
        <p className="mt-1 text-xs text-muted">
          {sensorLabel(c.sensor)} · {c.megapixels} MP · {year(c.announced)}
        </p>
      </div>
      <div className="flex items-baseline justify-between text-sm">
        {price !== null ? (
          <span>
            <span className="text-xs text-subtle">{c.lowestNewCents !== null ? "New from " : "Used from "}</span>
            <span className="price font-bold text-buy">{centsToUsd(price)}</span>
          </span>
        ) : c.launchPriceUsd ? (
          <span>
            <span className="text-xs text-subtle">Launched at </span>
            <span className="price font-semibold">{usdWhole(c.launchPriceUsd)}</span>
          </span>
        ) : (
          <span className="text-xs text-subtle">Price tracking soon</span>
        )}
      </div>
    </Link>
  );
}
