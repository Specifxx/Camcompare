// "More tech deals from our sister sites" (DECISIONS.md "Sites that grow each other", 2026-11-02): Compare
// Empire's best real deals for this market, its cameras first, read at build from data/family/family-cluster.json
// (lib/family.ts). One block per page; nothing when there is nothing real to show.
import { familyTiles } from "@/lib/family";
import { blockHeading, familyMoney, tileNote } from "@/lib/family-network";
import type { MarketCode } from "@/lib/markets";

export function FamilyCluster({ market }: { market: MarketCode }) {
  const tiles = familyTiles(market);
  if (!tiles.length) return null;
  const more = tiles.find((t) => t.more)?.more;
  return (
    <section aria-labelledby="family-tech">
      <h2 id="family-tech" className="h-section">{blockHeading("tech", "deal")}</h2>
      <p className="mt-1 text-sm text-muted">Today&apos;s best prices on Compare Empire, our sister site for cameras, phones, laptops and TVs, from its own daily price check.</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">
        {tiles.map(({ site, item }) => (
          <li key={item.url} className="card flex gap-3 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {item.image ? <img src={item.image} alt="" className="h-16 w-16 shrink-0 object-contain" loading="lazy" /> : null}
            <div className="min-w-0 text-sm">
              <div className="text-xs text-subtle">{site.name}</div>
              <a href={item.url} rel="noopener" className="line-clamp-2 font-semibold">{item.title}</a>
              <div><span className="price font-bold">{familyMoney(item.cents, item.currency)}</span> <span className="text-xs text-subtle">at {item.store}</span></div>
              <div className="text-xs text-muted">{tileNote(item)}</div>
            </div>
          </li>
        ))}
      </ul>
      {more ? <p className="mt-2 text-sm"><a href={more} rel="noopener" className="font-semibold">More deals on Compare Empire →</a></p> : null}
    </section>
  );
}
