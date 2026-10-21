// "Just announced": reads makers' official announcement feeds and writes
// data/releases.json (lib/releases/). Runs in refresh-prices.yml right after
// the price import and before the data commit, so a new release rides the
// same commit (and the same one build) as the prices.
//
// Sources (lib/releases/brands.ts), one request at a time:
//  - YouTube uploads: through the YouTube Data API (YOUTUBE_API_KEY, the
//    channel's uploads playlist, 1 quota unit per channel; the free quota is
//    10,000 a day). youtube.com/robots.txt disallows /feeds/videos.xml for
//    every crawler, so the public channel feed is read only when
//    RELEASES_YOUTUBE_RSS=1 says the owner chose it (DECISIONS.md, 2026-10-21).
//  - Newsroom RSS: the maker's own feed, only where its robots.txt allows,
//    and a 401/403/429 or bot challenge stops that feed (never worked around).
//
// Never fails the price job: a feed that breaks is reported in the file's
// `sources` and here; the script exits 1 only when every feed failed.
//   RELEASES_ONLY=sony,godox   only these brands (the rest keep their items)
import fs from "node:fs";
import { publishedCameras, publishedLenses } from "../src/lib/catalog";
import { buildIndex } from "../src/lib/matching";
import { RELEASE_BRANDS, type FeedSource, type ReleaseBrand } from "../src/lib/releases/brands";
import { isAnnouncement, matchProducts, mergeReleases, parseFeed, parseYoutubeApi, releaseId, type FeedItem, type Release, type ReleasesFile } from "../src/lib/releases/core";
import { readReleases, RELEASES_FILE, serializeReleases } from "../src/lib/releases/data";
import { blockedReason } from "../src/lib/sources/structured";
import { robotsAllows } from "../src/lib/sources/shopify";
import { sleep } from "../src/lib/sources/types";

const UA = "Mozilla/5.0 (compatible; CamCompareBot/0.1; +https://github.com/Specifxx/Camcompare)";
const DELAY_MS = 400;
const PER_FEED = 15;

type Run = ReleasesFile["sources"][string];

const robotsCache = new Map<string, string | null>();
async function allowed(url: string): Promise<boolean> {
  const u = new URL(url);
  if (!robotsCache.has(u.origin)) {
    const r = await fetch(`${u.origin}/robots.txt`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15_000) }).catch(() => null);
    // RFC 9309: a missing robots.txt allows everything; one the server can't serve disallows everything.
    robotsCache.set(u.origin, !r ? null : r.status >= 500 ? null : r.ok ? await r.text() : "");
  }
  const robots = robotsCache.get(u.origin);
  return robots !== null && robots !== undefined && robotsAllows(robots, u.pathname + u.search);
}

async function get(url: string, accept = "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5"): Promise<{ status: number; headers: Headers; text: string }> {
  const r = await fetch(url, { headers: { "User-Agent": UA, From: "camcompare-bot@users.noreply.github.com", Accept: accept }, signal: AbortSignal.timeout(20_000) });
  return { status: r.status, headers: r.headers, text: await r.text() };
}

const keepOnly = (f: FeedSource, items: FeedItem[]) => (f.only ? items.filter((it) => new RegExp(f.only!, "i").test(it.title)) : items);

const feedKey = (f: FeedSource) => (f.type === "youtube" ? `youtube:${f.channelId}` : f.url);

async function readFeed(f: FeedSource): Promise<{ run: Run; items: FeedItem[] }> {
  if (f.type === "youtube") {
    const key = process.env.YOUTUBE_API_KEY?.trim();
    if (key) {
      const playlist = `UU${f.channelId.slice(2)}`;
      const r = await get(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=${PER_FEED}&playlistId=${playlist}&key=${encodeURIComponent(key)}`, "application/json");
      if (r.status !== 200) return { run: { status: "error", items: 0, note: `YouTube API ${r.status}` }, items: [] };
      const items = keepOnly(f, parseYoutubeApi(JSON.parse(r.text)));
      return { run: { status: "ok", items: items.length }, items };
    }
    if (process.env.RELEASES_YOUTUBE_RSS !== "1") return { run: { status: "skipped", items: 0, note: "no YOUTUBE_API_KEY" }, items: [] };
    const r = await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${f.channelId}`);
    if (r.status !== 200) return { run: { status: "error", items: 0, note: `feed ${r.status}` }, items: [] };
    const items = keepOnly(f, parseFeed(r.text).slice(0, PER_FEED));
    return { run: { status: "ok", items: items.length }, items };
  }
  if (!(await allowed(f.url))) return { run: { status: "skipped", items: 0, note: "robots.txt disallows" }, items: [] };
  const r = await get(f.url);
  const blocked = blockedReason(r.status, r.headers, r.text);
  if (blocked) return { run: { status: "error", items: 0, note: `stopped: ${blocked}` }, items: [] };
  if (r.status !== 200) return { run: { status: "error", items: 0, note: `feed ${r.status}` }, items: [] };
  const items = keepOnly(f, parseFeed(r.text)).slice(0, PER_FEED * 2);
  return { run: { status: "ok", items: items.length }, items };
}

function toRelease(b: ReleaseBrand, f: FeedSource, it: FeedItem, index: ReturnType<typeof buildIndex>): Release {
  const products = matchProducts(it.title, b.name, b.catalog ?? b.key, index);
  return {
    id: releaseId(it.url),
    brand: b.key,
    title: it.title,
    url: it.url,
    publishedAt: it.publishedAt,
    kind: f.type === "youtube" ? "video" : "press",
    ...(it.videoId ? { videoId: it.videoId } : {}),
    products,
    isAnnouncement: isAnnouncement(it.title, products),
  };
}

async function main() {
  const index = buildIndex(publishedCameras(), publishedLenses());
  const prev = readReleases();
  const now = new Date().toISOString();
  const only = process.env.RELEASES_ONLY?.split(",").map((s) => s.trim()).filter(Boolean);
  const brands = RELEASE_BRANDS.filter((b) => !only?.length || only.includes(b.key));

  const sources: ReleasesFile["sources"] = { ...prev.sources };
  const fresh: Release[] = [];
  const perBrand: Record<string, { feeds: number; ok: number; items: number; announced: number }> = {};
  let tried = 0;
  let failed = 0;
  for (const b of brands) {
    const stat = (perBrand[b.key] = { feeds: b.feeds.length, ok: 0, items: 0, announced: 0 });
    for (const f of b.feeds) {
      let res: { run: Run; items: FeedItem[] };
      try {
        res = await readFeed(f);
      } catch (e) {
        res = { run: { status: "error", items: 0, note: String((e as Error).message ?? e).slice(0, 120) }, items: [] };
      }
      sources[feedKey(f)] = res.run;
      if (res.run.status !== "skipped") tried++;
      if (res.run.status === "error") {
        failed++;
        console.warn(`fetch-releases: ${b.key} ${f.label}: ${res.run.note}`);
      }
      if (res.run.status === "ok") stat.ok++;
      for (const it of res.items) {
        const r = toRelease(b, f, it, index);
        fresh.push(r);
        stat.items++;
        if (r.isAnnouncement) stat.announced++;
      }
      await sleep(DELAY_MS);
    }
  }

  // Re-match what we already have: the catalog grows, and a release that
  // named no product yet may name one now (and its preorder alerts can fire).
  const brandOf = new Map(RELEASE_BRANDS.map((b) => [b.key, b]));
  const rematched = prev.releases.map((r) => {
    const b = brandOf.get(r.brand);
    if (!b) return r;
    const products = matchProducts(r.title, b.name, b.catalog ?? b.key, index);
    return { ...r, products, isAnnouncement: isAnnouncement(r.title, products) };
  });
  // Feeds that answered keep only what they still list or what we kept before; a feed that failed keeps its old items.
  const releases = mergeReleases(rematched, fresh, now);
  const known = new Set(RELEASE_BRANDS.map((b) => b.key));
  const out: ReleasesFile = { generatedAt: now, sources: Object.fromEntries(Object.entries(sources).filter(([k]) => RELEASE_BRANDS.some((b) => b.feeds.some((f) => feedKey(f) === k)))), releases: releases.filter((r) => known.has(r.brand)) };

  // Write only when something changed, so a quiet run adds nothing to the data commit.
  const same = JSON.stringify(prev.releases) === JSON.stringify(out.releases) && JSON.stringify(prev.sources) === JSON.stringify(out.sources);
  if (!same) fs.writeFileSync(RELEASES_FILE, serializeReleases(out));

  const prevIds = new Set(prev.releases.map((r) => r.id));
  const added = out.releases.filter((r) => !prevIds.has(r.id));
  for (const [k, s] of Object.entries(perBrand)) console.log(`fetch-releases: ${k.padEnd(12)} ${s.ok}/${s.feeds} feeds, ${String(s.items).padStart(3)} items, ${s.announced} announcements`);
  console.log(`fetch-releases: ${out.releases.length} kept (${out.releases.filter((r) => r.isAnnouncement).length} announcements), ${added.length} new, ${added.filter((r) => r.isAnnouncement).length} new announcements${same ? ", file unchanged" : ""}`);
  if (tried > 0 && failed === tried) {
    console.error("fetch-releases: every feed failed");
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(`fetch-releases: ${(e as Error).message ?? e}`);
  process.exit(1);
});
