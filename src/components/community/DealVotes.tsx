"use client";
/**
 * <DealVotes dealKey="us:sony-a7-iv:used" />: a compact ▲ score ▼ for one deal.
 *
 * Props
 *  - `dealKey` (string, required): a stable key for the deal, chosen by the
 *    feed. Lowercase letters, digits and `: _ . -`, at most 120 characters
 *    (DEAL_KEY_RE in lib/community/rules.ts), e.g. `${market}:${slug}:${condition}`.
 *    Keep it stable across builds, or the votes reset.
 *  - `initialScore` (number, optional): a score to show before the fetch.
 *  - `layout` ("row" | "column", default "row"): arrows beside or above/below the score.
 *  - `className` (string, optional): on the wrapper.
 *
 * Every DealVotes on a page shares one request: keys asked for in the same
 * tick go to GET /api/community/deals?keys=… together (100 a request, CDN-
 * cached 30 s), and a signed-in member's own votes to one
 * GET /api/community/votes/mine. Deal votes never earn CamKarma and never
 * change the order of deals or prices: the score is shown, nothing more.
 * Signed out, clicking an arrow links to /community/signin.
 */
import { useEffect, useState } from "react";
import { DEAL_KEY_RE, DEAL_KEYS_MAX, type VoteValue } from "@/lib/community/rules";
import { VoteArrows } from "./bits";
import { myVotes } from "./client";

type Batch = { keys: Set<string>; waiters: ((scores: Record<string, number>, mine: Record<string, VoteValue>) => void)[] };
let pending: Batch | null = null;

function fetchBatch(keys: string[]): Promise<{ scores: Record<string, number>; mine: Record<string, VoteValue> }> {
  const chunks: string[][] = [];
  for (let i = 0; i < keys.length; i += DEAL_KEYS_MAX) chunks.push(keys.slice(i, i + DEAL_KEYS_MAX));
  return Promise.all(
    chunks.map(async (c) => {
      const [s, m] = await Promise.all([
        fetch(`/api/community/deals?keys=${c.map(encodeURIComponent).join(",")}`)
          .then((r) => (r.ok ? r.json() : { scores: {} }))
          .catch(() => ({ scores: {} })) as Promise<{ scores?: Record<string, number> }>,
        myVotes("deal", c),
      ]);
      return { scores: s.scores ?? {}, mine: m };
    }),
  ).then((rs) => ({ scores: Object.assign({}, ...rs.map((r) => r.scores)), mine: Object.assign({}, ...rs.map((r) => r.mine)) }));
}

function requestScore(key: string): Promise<{ score: number; mine: VoteValue }> {
  return new Promise((resolve) => {
    if (!pending) {
      const b: Batch = { keys: new Set(), waiters: [] };
      pending = b;
      setTimeout(() => {
        pending = null;
        void fetchBatch([...b.keys]).then(({ scores, mine }) => b.waiters.forEach((w) => w(scores, mine)));
      }, 0);
    }
    pending.keys.add(key);
    pending.waiters.push((scores, mine) => resolve({ score: scores[key] ?? 0, mine: mine[key] ?? 0 }));
  });
}

export type DealVotesProps = { dealKey: string; initialScore?: number; layout?: "row" | "column"; className?: string };

export default function DealVotes({ dealKey, initialScore = 0, layout = "row", className = "" }: DealVotesProps) {
  const valid = DEAL_KEY_RE.test(dealKey);
  const [s, setS] = useState<{ score: number; mine: VoteValue }>({ score: initialScore, mine: 0 });
  useEffect(() => {
    if (!valid) return;
    let live = true;
    void requestScore(dealKey).then((r) => live && setS(r));
    return () => {
      live = false;
    };
  }, [dealKey, valid]);
  if (!valid) return null;
  return (
    <div className={className} aria-label="Deal votes">
      <VoteArrows
        kind="deal"
        target={dealKey}
        score={s.score}
        mine={s.mine}
        inline={layout === "row"}
        onNeedSignIn={() => {
          location.href = `/community/signin?next=${encodeURIComponent(location.pathname)}`;
        }}
      />
    </div>
  );
}
