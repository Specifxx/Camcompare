import { initials, PLATFORM_STYLE, type Creator } from "@/lib/creators";

// One featured creator: avatar, what they make, their channels, and the "Buy them a coffee" button that goes to THEIR tip
// page. Server HTML, no script. rel="noopener" without "noreferrer": the creator's analytics should see camcompare.app as
// the referrer, that is the point of the listing.
const TINTS = ["from-accent/25 via-accent-soft to-buy-soft", "from-azure/25 via-accent-soft to-accent/10", "from-buy/20 via-accent-soft to-azure/15", "from-accent/15 via-buy-soft to-accent-soft"];

export function CreatorCard({ creator, index = 0 }: { creator: Creator; index?: number }) {
  const main = creator.links[0];
  return (
    <article id={creator.slug} className="card card-hover relative flex scroll-mt-24 flex-col overflow-hidden">
      <div className={`h-20 bg-gradient-to-br ${TINTS[index % TINTS.length]}`} aria-hidden />
      <div className="-mt-10 flex flex-1 flex-col px-5 pb-5">
        <div className="flex items-end justify-between gap-3">
          {creator.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={creator.avatar} alt={`${creator.name}'s avatar`} width={80} height={80} loading="lazy" decoding="async" className="h-20 w-20 rounded-2xl border-4 border-surface bg-raised object-cover shadow-card" />
          ) : (
            <div aria-hidden className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-surface bg-accent text-2xl font-extrabold text-accent-fg shadow-card">
              {initials(creator.name)}
            </div>
          )}
          {creator.region && <span className="chip mb-1">{creator.region}</span>}
        </div>
        <h3 className="mt-3 font-display text-lg font-bold">{creator.name}</h3>
        <p className="mt-1 text-sm leading-6 text-muted">{creator.blurb}</p>
        {creator.tags && creator.tags.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {creator.tags.slice(0, 3).map((t) => (
              <li key={t} className="chip">
                {t}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {creator.links.map((l) => {
            const st = PLATFORM_STYLE[l.platform];
            return (
              <a key={l.url} href={l.url} target="_blank" rel="noopener" className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold no-underline transition-opacity hover:no-underline hover:opacity-85" style={{ backgroundColor: st.bg, color: st.fg }}>
                {l.platform}
                {l.handle && <span className="font-medium opacity-80">{l.handle}</span>}
              </a>
            );
          })}
        </div>
        <div className="mt-auto pt-5">
          {creator.tipUrl ? (
            <a href={creator.tipUrl} target="_blank" rel="noopener" className="btn-primary flex min-h-11 w-full">
              <CoffeeIcon /> Buy {creator.name.split(" ")[0]} a coffee
            </a>
          ) : main ? (
            <a href={main.url} target="_blank" rel="noopener" className="btn-ghost flex min-h-11 w-full">
              Watch on {main.platform} →
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function CoffeeIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8z" />
      <path d="M16 10h2a2.5 2.5 0 0 1 0 5h-2" />
      <path d="M8 3v2M11 3v2M14 3v2" />
    </svg>
  );
}
