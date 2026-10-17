import type { Camera } from "@/lib/catalog/schema";
import { peerRanks } from "@/lib/insights";

/** "Lighter than 80% of full-frame mirrorless cameras": facts from the catalog, strongest first. */
export default function PeerRanks({ camera }: { camera: Camera }) {
  const ranks = peerRanks(camera).filter((r) => r.pct >= 50).slice(0, 4);
  if (!ranks.length) return null;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {ranks.map((r) => (
        <li key={r.label} className="card p-3 text-sm">
          <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-raised">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(4, r.pct)}%` }} />
          </div>
          <span className="font-semibold">{r.value}</span>
          <span className="text-muted">
            {" "}
            — {r.phrase} {r.pct}% of the {r.group} we list
          </span>
        </li>
      ))}
    </ul>
  );
}
