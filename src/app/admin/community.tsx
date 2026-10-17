// The community section of the owner's /admin page: open reports and the
// newest posts, with hide / unhide, ban / unban and "looks fine" (resolve)
// buttons that post to /admin/moderate. Server component: read at request
// time only when the owner opens /admin (already force-dynamic).
import { adminRecentPosts, adminReports, communityConfigured, communityCounts, type AdminPost, type AdminReport } from "@/lib/community/db";
import { authSecret } from "@/lib/community/auth";
import { ownerEmail } from "@/lib/community/notify";
import { AUTO_HIDE_REPORTS, CAMEXPERT_KARMA, CAMEXPERT_MIN_ACCOUNT_DAYS, REPORT_REASON_LABEL, userPath, type ReportReason } from "@/lib/community/rules";
import { targetLink } from "@/lib/community/targets";
import { logSafe } from "@/lib/feedback";

function Action({ action, kind, id, label, danger }: { action: string; kind: string; id: string; label: string; danger?: boolean }) {
  return (
    <form method="post" action="/admin/moderate" className="inline">
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={`text-xs underline ${danger ? "text-warn" : "text-accent"}`}>
        {label}
      </button>
    </form>
  );
}

const when = (iso: string) => iso.slice(0, 16).replace("T", " ") + " UTC";

function Row({ kind, id, excerpt, author, authorId, authorBanned, hidden, where, meta }: { kind: string; id: string; excerpt: string; author: string | null; authorId: string | null; authorBanned: boolean; hidden: boolean; where: string; meta: React.ReactNode }) {
  const link = where ? targetLink(where) : null;
  return (
    <li className="border-b border-line py-2 text-sm">
      <div className="flex flex-wrap gap-x-3 text-xs text-muted">
        <span>
          {kind} #{id}
        </span>
        {author ? <a href={userPath(author)}>{author}</a> : <span>no username</span>}
        {authorBanned && <span className="text-warn">banned</span>}
        {hidden && <span className="text-warn">hidden</span>}
        {link && <a href={link.href}>{link.label}</a>}
        {meta}
      </div>
      <p className="mt-1 whitespace-pre-wrap break-words">{excerpt}</p>
      <div className="mt-1 flex flex-wrap gap-x-4">
        {hidden ? <Action action="unhide" kind={kind} id={id} label="Unhide" /> : <Action action="hide" kind={kind} id={id} label="Hide" danger />}
        {authorId && (authorBanned ? <Action action="unban" kind="user" id={authorId} label={`Unban ${author ?? "member"}`} /> : <Action action="ban" kind="user" id={authorId} label={`Ban ${author ?? "member"}`} danger />)}
      </div>
    </li>
  );
}

export default async function CommunityAdmin() {
  if (!communityConfigured()) return null;
  let data: { reports: AdminReport[]; posts: AdminPost[]; counts: Awaited<ReturnType<typeof communityCounts>> } | null = null;
  try {
    const [reports, posts, counts] = await Promise.all([adminReports(50), adminRecentPosts(50), communityCounts()]);
    data = { reports, posts, counts };
  } catch (e) {
    console.error(`admin: community read failed: ${logSafe(e)}`);
  }
  return (
    <section aria-labelledby="community-h" id="community">
      <h2 id="community-h" className="h-section">Community</h2>
      <p className="mt-1 text-sm text-muted">
        Sign-in {authSecret() ? "is on" : "is off: set AUTH_SECRET on Vercel"}. Owner emails {ownerEmail() ? "go to OWNER_EMAIL" : "are off: set OWNER_EMAIL"} (capped per day). {AUTO_HIDE_REPORTS} reports hide a post automatically. CamExpert: {CAMEXPERT_KARMA} CamKarma and an account {CAMEXPERT_MIN_ACCOUNT_DAYS}+ days old. Hiding takes up to a
        minute and a half to leave every cached page.
      </p>
      {!data ? (
        <p className="mt-3 text-sm text-warn">The community tables didn&apos;t answer. Try reloading in a minute.</p>
      ) : (
        <>
          <p className="mt-2 text-sm">
            {data.counts.users} members ({data.counts.banned} banned) · {data.counts.comments} comments · {data.counts.reviews} reviews · {data.counts.threads} threads · {data.counts.openReports} open reports
          </p>
          <h3 className="mt-4 font-semibold">Open reports</h3>
          {!data.reports.length && <p className="text-sm text-muted">None.</p>}
          <ul>
            {data.reports.map((r) => (
              <Row
                key={`${r.kind}-${r.targetId}`}
                kind={r.kind}
                id={r.targetId}
                excerpt={r.excerpt}
                author={r.author}
                authorId={r.authorId}
                authorBanned={r.authorBanned}
                hidden={r.hidden}
                where={r.where}
                meta={
                  <>
                    <span>
                      {r.reports} report{r.reports === 1 ? "" : "s"}: {r.reasons.map((x) => REPORT_REASON_LABEL[x as ReportReason] ?? x).join(", ")}
                    </span>
                    <span>{when(r.lastAt)}</span>
                    {r.notes.length > 0 && <span className="w-full">Notes: {r.notes.join(" / ")}</span>}
                    <Action action="resolve" kind={r.kind} id={r.targetId} label="Looks fine (dismiss)" />
                  </>
                }
              />
            ))}
          </ul>
          <h3 className="mt-6 font-semibold">Newest posts</h3>
          {!data.posts.length && <p className="text-sm text-muted">Nothing posted yet.</p>}
          <ul>
            {data.posts.map((p) => (
              <Row key={`${p.kind}-${p.id}`} kind={p.kind} id={p.id} excerpt={p.deleted ? "(deleted by its author)" : p.excerpt} author={p.author} authorId={p.authorId} authorBanned={p.authorBanned} hidden={p.hidden} where={p.where} meta={<span>{when(p.createdAt)}</span>} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
