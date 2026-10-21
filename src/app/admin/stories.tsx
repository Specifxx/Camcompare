// The owner's stories and requests sections of /admin: feature a story
// (listed first, indexable, cover shown) or unfeature it, and set a
// request's status (planned / done / won't do) with an optional note. Hide
// and ban are the community section's buttons (./community.tsx), which
// cover stories and requests too. Server component, read only when the
// owner opens /admin.
import { communityConfigured } from "@/lib/community/db";
import { REQUEST_STATUSES, requestKindLabel, requestStatusLabel } from "@/lib/community/requests";
import { storyPath } from "@/lib/community/stories";
import { adminRequests, adminStories, type AdminRequest, type AdminStory } from "@/lib/community/stories-db";
import { logSafe } from "@/lib/feedback";

const when = (iso: string) => iso.slice(0, 10);

function Feature({ id, on }: { id: string; on: boolean }) {
  return (
    <form method="post" action="/admin/curate" className="inline">
      <input type="hidden" name="what" value="feature" />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="featured" value={on ? "0" : "1"} />
      <button type="submit" className={`text-xs underline ${on ? "text-warn" : "text-accent"}`}>
        {on ? "Unfeature" : "Feature (list first, allow indexing)"}
      </button>
    </form>
  );
}

function StatusForm({ r }: { r: AdminRequest }) {
  return (
    <form method="post" action="/admin/curate" className="mt-1 flex flex-wrap items-center gap-2 text-xs">
      <input type="hidden" name="what" value="status" />
      <input type="hidden" name="id" value={r.id} />
      <select name="status" defaultValue={r.status} className="rounded border border-line bg-surface px-1 py-0.5">
        {REQUEST_STATUSES.map((s) => (
          <option key={s.slug} value={s.slug}>
            {s.label}
          </option>
        ))}
      </select>
      <input name="note" defaultValue={r.statusNote ?? ""} maxLength={300} placeholder="Note (optional, public)" className="min-w-[12rem] flex-1 rounded border border-line bg-surface px-1 py-0.5" />
      <button type="submit" className="text-accent underline">
        Set status
      </button>
    </form>
  );
}

export default async function StoriesAdmin() {
  if (!communityConfigured()) return null;
  let data: { stories: AdminStory[]; requests: AdminRequest[] } | null = null;
  try {
    const [stories, requests] = await Promise.all([adminStories(40), adminRequests(60)]);
    data = { stories, requests };
  } catch (e) {
    console.error(`admin: stories read failed: ${logSafe(e)}`);
  }
  if (!data) return <p className="text-sm text-warn">The stories and requests tables didn&apos;t answer. Try reloading in a minute.</p>;
  return (
    <>
      <section aria-labelledby="stories-h" id="stories">
        <h2 id="stories-h" className="h-section">Member stories</h2>
        <p className="mt-1 text-sm text-muted">
          Stories are noindex and show no cover image until you feature them. Featuring puts one first on /stories and on its products&apos; pages and lets search
          engines index it; an edit by its author unfeatures it until you look again. Check the cover image before featuring: it is hosted elsewhere.
        </p>
        {!data.stories.length && <p className="mt-2 text-sm text-muted">No stories yet.</p>}
        <ul>
          {data.stories.map((s) => (
            <li key={s.id} className="border-b border-line py-2 text-sm">
              <div className="flex flex-wrap gap-x-3 text-xs text-muted">
                <span>story #{s.id}</span>
                <span>{s.author ?? "no username"}</span>
                {s.authorBanned && <span className="text-warn">banned</span>}
                {s.hidden && <span className="text-warn">hidden</span>}
                {s.featured && <span className="font-semibold text-win">featured</span>}
                <span>score {s.score}</span>
                <span>{when(s.createdAt)}</span>
                {s.products.length > 0 && <span>{s.products.join(", ")}</span>}
              </div>
              <p className="mt-1">
                <a href={storyPath(s.id)}>{s.title}</a>
              </p>
              {s.cover && (
                <p className="break-all text-xs text-muted">
                  Cover: <a href={s.cover} rel="noreferrer nofollow">{s.cover}</a>
                </p>
              )}
              <div className="mt-1">
                <Feature id={s.id} on={s.featured} />
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="requests-h" id="requests">
        <h2 id="requests-h" className="h-section">Requests</h2>
        <p className="mt-1 text-sm text-muted">The public request board (/requests), open and planned first, by votes. The status and note show on the board.</p>
        {!data.requests.length && <p className="mt-2 text-sm text-muted">No requests yet.</p>}
        <ul>
          {data.requests.map((r) => (
            <li key={r.id} className="border-b border-line py-2 text-sm">
              <div className="flex flex-wrap gap-x-3 text-xs text-muted">
                <span>request #{r.id}</span>
                <span>{requestKindLabel(r.kind)}</span>
                <span>{r.author ?? "no username"}</span>
                {r.hidden && <span className="text-warn">hidden</span>}
                <span>score {r.score}</span>
                <span>{requestStatusLabel(r.status)}</span>
                <span>{when(r.createdAt)}</span>
              </div>
              <p className="mt-1 font-semibold">{r.title}</p>
              {r.body && <p className="whitespace-pre-wrap break-words text-muted">{r.body}</p>}
              <StatusForm r={r} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
