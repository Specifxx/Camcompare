// The home page's "Just announced" strip: the four newest announcements as
// compact cards linking to /releases. Server component, static, no video
// (one thumbnail each, lazy).
import Link from "next/link";
import { marketPath, type MarketCode } from "@/lib/markets";
import { announcements } from "@/lib/releases/data";
import { Ago } from "./ReleaseClient";
import { BrandMark, releaseStores, StateBadge } from "./ReleasesView";

export default function JustAnnounced({ market: m, max = 4 }: { market: MarketCode; max?: number }) {
  const list = announcements().slice(0, max);
  if (!list.length) return null;
  return (
    <section aria-labelledby="announced-title">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-subtle">From the makers</p>
          <h2 id="announced-title" className="mt-1 text-xl font-semibold leading-tight sm:text-2xl">
            Just announced
          </h2>
        </div>
        <Link href={marketPath(m, "/releases")} prefetch={false} className="shrink-0 text-sm font-semibold">
          All announcements
        </Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {list.map((r) => {
          const best = releaseStores(r, m)[0];
          return (
            <li key={r.id}>
              <Link href={marketPath(m, `/releases#${r.id}`)} prefetch={false} className="card group flex h-full flex-col gap-2 overflow-hidden text-fg no-underline hover:border-accent hover:no-underline">
                {r.videoId ? (
                  // eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail
                  <img src={`https://i.ytimg.com/vi/${r.videoId}/mqdefault.jpg`} alt="" loading="lazy" decoding="async" className="aspect-video w-full bg-raised object-cover" />
                ) : (
                  <span className="flex aspect-video w-full items-center justify-center bg-raised text-xs font-semibold text-muted">Press release</span>
                )}
                <span className="flex flex-col gap-1.5 px-3 pb-3">
                  <span className="flex items-center gap-2 text-xs text-subtle">
                    <BrandMark brand={r.brand} />
                    <Ago at={r.publishedAt} />
                  </span>
                  <span className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-accent">{r.title}</span>
                  {best && (
                    <span className="mt-auto">
                      <StateBadge state={best.state} />
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
