// data/releases.json, written by scripts/fetch-releases.ts after each price
// import and committed with the prices (one build, not two). Pages read it at
// build time; nothing reads it at request time.
import fs from "node:fs";
import path from "node:path";
import { emptyReleases, releasesFileSchema, type Release, type ReleasesFile } from "./core";

export const RELEASES_FILE = path.join(process.cwd(), "data", "releases.json");

let memo: { file: string; data: ReleasesFile } | null = null;

export function readReleases(file = RELEASES_FILE): ReleasesFile {
  if (memo?.file === file) return memo.data;
  const data = fs.existsSync(file) ? releasesFileSchema.parse(JSON.parse(fs.readFileSync(file, "utf8"))) : emptyReleases();
  memo = { file, data };
  return data;
}

const sameWeek = (a: Release, b: Release) => Math.abs(Date.parse(a.publishedAt) - Date.parse(b.publishedAt)) < 7 * 86_400_000;
const titleKey = (r: Release) => `${r.brand}:${r.title.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;

/**
 * Announcements only, newest first: what the page shows. A maker that posts
 * the same video twice (two channels, a re-upload) shows once: the same
 * title from the same maker within a week is one card, the newest.
 */
export function announcements(file?: string): Release[] {
  const seen = new Map<string, Release[]>();
  const out: Release[] = [];
  for (const r of readReleases(file).releases) {
    if (!r.isAnnouncement) continue;
    const k = titleKey(r);
    if ((seen.get(k) ?? []).some((o) => sameWeek(o, r))) continue;
    (seen.get(k) ?? seen.set(k, []).get(k)!).push(r);
    out.push(r);
  }
  return out;
}
export const releaseById = (id: string, file?: string): Release | null => readReleases(file).releases.find((r) => r.id === id) ?? null;

/** The compact JSON the script writes: one release per line, so a day's diff is a few lines. */
export function serializeReleases(f: ReleasesFile): string {
  const head = JSON.stringify({ generatedAt: f.generatedAt, sources: f.sources });
  const rows = f.releases.map((r) => JSON.stringify(r));
  return `${head.slice(0, -1)},"releases":[\n${rows.join(",\n")}\n]}\n`;
}
