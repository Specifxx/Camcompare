// IndexNow (Bing, Yandex, Seznam, Naver): tell the engines which pages exist so
// they recrawl now instead of on their own schedule. Google does not take it.
//
// The key is public by design: every engine fetches it from /indexnow.txt
// (src/app/indexnow.txt/route.ts) to check that a submission for this host is
// ours, and a key is verified per host, so sharing one across sites is allowed.
// CamCompare's own, generated 2026-10-26; INDEXNOW_KEY in Vercel
// overrides it. The daily job (scripts/indexnow-submit.ts) reads whatever the
// live key file serves, so the two can never disagree.
//
// Pure: no database, no network of its own. tests/indexnow.test.ts.
export const DEFAULT_INDEXNOW_KEY = "e1b449a139464aa1985a25351882050f";

/** IndexNow's key format: 8 to 128 of a-z, A-Z, 0-9 and "-". */
export function isIndexNowKey(v: string | null | undefined): v is string {
  return !!v && /^[a-zA-Z0-9-]{8,128}$/.test(v);
}

export function indexNowKey(env: Record<string, string | undefined> = process.env): string {
  const k = env.INDEXNOW_KEY?.trim();
  return isIndexNowKey(k) ? k : DEFAULT_INDEXNOW_KEY;
}

const locs = (xml: string): string[] => [...xml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/g)].map((m) => m[1]!.replace(/&amp;/g, "&"));

/** Every page URL of a sitemap: a <sitemapindex> is followed one child at a time; a plain <urlset> is its own single child. */
export async function sitemapUrls(sitemapUrl: string, fetchText: (url: string) => Promise<string>, pause = 250): Promise<string[]> {
  const xml = await fetchText(sitemapUrl);
  if (!/<sitemapindex/.test(xml)) return locs(xml);
  const out: string[] = [];
  for (const child of locs(xml)) {
    out.push(...locs(await fetchText(child)));
    if (pause) await new Promise((r) => setTimeout(r, pause));
  }
  return [...new Set(out)];
}

export interface SubmissionPlan {
  origin: string;
  host: string;
  keyLocation: string;
  urls: string[];
  dropped: number;
}

/**
 * Where a submission goes: the origin of the sitemap's OWN URLs (the canonical
 * www.camcompare.app), only the URLs on it, and the key file there. IndexNow
 * answers 422 to any URL off the request's host (MTG Compare's daily run failed
 * that way for a week when its workflow named the wrong host). Null without URLs.
 */
export function submissionPlan(urls: readonly string[]): SubmissionPlan | null {
  const first = urls.find((u) => /^https?:\/\//.test(u));
  if (!first) return null;
  const { origin, host } = new URL(first);
  const same = urls.filter((u) => {
    try {
      return new URL(u).host === host;
    } catch {
      return false;
    }
  });
  return { origin, host, keyLocation: `${origin}/indexnow.txt`, urls: same, dropped: urls.length - same.length };
}

/** IndexNow takes at most 10,000 URLs per request. */
export const INDEXNOW_BATCH = 10_000;
