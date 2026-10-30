import type { Camera } from "@/lib/catalog/schema";
import { lowLightLinks, pixelPitchUm } from "@/lib/lowlight";
import { sensorLabel } from "@/lib/specs/definitions";

/** Low-light and noise: pixel size from the spec sheet, then the sites that measure it. */
export default function LowLight({ cams }: { cams: { c: Camera; brandName: string }[] }) {
  const links = lowLightLinks(cams);
  return (
    <div className="card flex flex-col gap-4 p-4">
      <div className={`grid gap-3 ${cams.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {cams.map(({ c }) => (
          <div key={c.slug}>
            {cams.length > 1 && <p className="text-xs font-semibold text-subtle">{c.shortName}</p>}
            <p className="text-lg font-bold">
              {pixelPitchUm(c).toFixed(1)} µm <span className="text-sm font-normal text-muted">pixels</span>
            </p>
            <p className="text-xs text-muted">
              {c.specs.megapixels} MP on a {c.specs.sensorFormat ? sensorLabel(c.specs.sensorFormat).toLowerCase() : ""} sensor
              {c.specs.isoMax ? `, ISO up to ${c.specs.isoMax.toLocaleString("en-US")}` : ""}
            </p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">
        Bigger pixels gather more light each, so they tend to show less noise at high ISO, but sensor design matters as much. For real noise at ISO 6400, these sites measure it:
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {links.map((l) => (
          <li key={l.label}>
            <a href={l.href} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-line px-3 py-2 text-sm no-underline hover:border-accent hover:no-underline">
              <span className="font-semibold text-fg">{l.label} ↗</span>
              <span className="block text-xs text-muted">{l.note}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
