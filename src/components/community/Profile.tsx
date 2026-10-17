"use client";
// A member's page, client-rendered: /u/<username> is served by the static /u
// shell (a rewrite in next.config.js). CamKarma, the CamExpert badge (and
// how far off it is), recent comments and reviews.
import { useEffect, useState } from "react";
import { ago, CAMEXPERT_KARMA, CAMEXPERT_MIN_ACCOUNT_DAYS } from "@/lib/community/rules";
import { ExpertBadge } from "./bits";
import { api, signOut, useMe } from "./client";
import { stars } from "./Reviews";

type P = {
  username: string;
  createdAt: string;
  karma: number;
  expert: boolean;
  comments: { id: string; createdAt: string; body: string; score: number; href: string; label: string }[];
  reviews: { id: string; createdAt: string; rating: number; body: string; score: number; href: string; label: string }[];
};

export default function Profile() {
  const { user } = useMe();
  const [p, setP] = useState<P | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const m = location.pathname.match(/^\/u\/([^/]+)\/?$/);
    if (!m) return setErr("No member by that name.");
    void api<{ profile: P }>(`/api/community/users/${m[1]}`).then((r) => {
      if (!r.ok) return setErr(r.error);
      setP(r.profile);
      document.title = `${r.profile.username} | CamCompare community`;
    });
  }, []);

  if (err)
    return (
      <p className="text-sm text-muted">
        {err} <a href="/community">Community</a>
      </p>
    );
  if (!p) return <p className="text-sm text-muted">Loading…</p>;
  const own = user?.username === p.username;
  return (
    <div className="space-y-6">
      <header className="border-b border-line pb-3">
        <h1 className="text-2xl font-semibold">
          {p.username}
          {p.expert && <ExpertBadge />}
        </h1>
        <p className="mt-1 text-sm text-muted">
          <span className="price font-semibold text-fg">{p.karma}</span> CamKarma · member since {p.createdAt.slice(0, 10)}
        </p>
        <p className="mt-1 text-xs text-subtle">
          CamKarma is the sum of votes on {own ? "your" : "their"} comments and reviews. CamExpert: {CAMEXPERT_KARMA} CamKarma and a member for {CAMEXPERT_MIN_ACCOUNT_DAYS} days
          {!p.expert && p.karma < CAMEXPERT_KARMA ? ` (${CAMEXPERT_KARMA - p.karma} to go)` : ""}.
        </p>
        {own && (
          <button type="button" onClick={() => void signOut().then(() => (location.href = "/community"))} className="mt-2 text-xs text-accent underline">
            Sign out
          </button>
        )}
      </header>
      <section>
        <h2 className="text-lg font-semibold">Recent reviews</h2>
        {!p.reviews.length && <p className="text-sm text-muted">None yet.</p>}
        <ul>
          {p.reviews.map((r) => (
            <li key={r.id} className="border-b border-line py-2 text-sm">
              <a href={r.href} className="font-semibold">
                {r.label}
              </a>{" "}
              <span className="text-accent">{stars(r.rating)}</span>
              <span className="text-xs text-subtle">
                {" "}
                · {r.score} points · {ago(r.createdAt)}
              </span>
              <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap break-words text-muted">{r.body}</p>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Recent comments</h2>
        {!p.comments.length && <p className="text-sm text-muted">None yet.</p>}
        <ul>
          {p.comments.map((c) => (
            <li key={c.id} className="border-b border-line py-2 text-sm">
              <p className="text-xs text-subtle">
                on <a href={c.href}>{c.label}</a> · {c.score} points · {ago(c.createdAt)}
              </p>
              <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap break-words">{c.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
