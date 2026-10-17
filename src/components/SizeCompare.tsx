import type { Camera } from "@/lib/catalog/schema";

const COLORS = ["rgb(var(--c-accent))", "rgb(var(--c-warn))", "rgb(var(--c-win))", "rgb(var(--c-muted))"];

/**
 * Front and top views drawn to scale from the published W×H×D, overlaid so
 * the difference reads at a glance (what camerasize.com does with photos).
 * Bodies only; outlines, not photos, so nothing implies a shape we don't know.
 */
export default function SizeCompare({ cameras }: { cameras: Camera[] }) {
  const known = cameras.filter((c) => c.specs.dimensionsMm);
  if (known.length < 2) return null;
  const maxW = Math.max(...known.map((c) => c.specs.dimensionsMm![0]));
  const maxH = Math.max(...known.map((c) => c.specs.dimensionsMm![1]));
  const maxD = Math.max(...known.map((c) => c.specs.dimensionsMm![2]));
  const S = 1.6; // px per mm
  const pad = 10;
  const frontW = maxW * S + pad * 2;
  const frontH = maxH * S + pad * 2;
  const topH = maxD * S + pad * 2;
  return (
    <figure className="card p-4">
      <div className="flex flex-wrap items-end gap-6">
        {[
          { label: "Front (width × height)", w: frontW, h: frontH, dims: (c: Camera) => [c.specs.dimensionsMm![0], c.specs.dimensionsMm![1]] },
          { label: "Top (width × depth)", w: frontW, h: topH, dims: (c: Camera) => [c.specs.dimensionsMm![0], c.specs.dimensionsMm![2]] },
        ].map((v) => (
          <div key={v.label}>
            <svg width={v.w} height={v.h} viewBox={`0 0 ${v.w} ${v.h}`} className="max-w-full" role="img" aria-label={`${v.label}, to scale`}>
              {known.map((c, i) => {
                const [w, h] = v.dims(c);
                return <rect key={c.slug} x={pad + (maxW * S - w * S) / 2} y={v.h - pad - h * S} width={w * S} height={h * S} rx={6} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth={2} />;
              })}
            </svg>
            <p className="mt-1 text-xs text-subtle">{v.label}</p>
          </div>
        ))}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
        {known.map((c, i) => (
          <span key={c.slug}>
            <span className="mr-1 inline-block h-2 w-3 rounded-sm align-middle" style={{ background: COLORS[i % COLORS.length] }} />
            {c.shortName}: {c.specs.dimensionsMm!.join(" × ")} mm{c.specs.weightG ? `, ${c.specs.weightG} g` : ""}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
