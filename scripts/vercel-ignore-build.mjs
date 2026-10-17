#!/usr/bin/env node
// Vercel's ignoreCommand (vercel.json): exit 0 skips the build, exit 1 builds.
// Every production build re-prerenders ~2,400 pages and empties the CDN, so
// the ISR cache is read again for every page after it (DECISIONS.md, "Cutting
// Vercel spend"). It builds:
//   - only `main` (every other branch is skipped, previews included);
//   - always when the subject carries [deploy] (any case);
//   - when anything outside docs, tests and workflows changed;
//   - for a data-only commit (the price job), only when a price, stock state
//     or listing actually changed (timestamps ignored) AND the last deployment
//     is at least DATA_GAP_H hours old. A skipped commit's data ships with
//     the next build, so a price on the site is at most ~DATA_GAP_H + 3 h old.
// Runs before `npm install`: plain Node and git only. Any doubt builds.
import { execFileSync } from "node:child_process";

const DATA_GAP_H = 6;
// Keys that change on every run without changing what a page shows.
const VOLATILE = new Set(["generatedAt", "updatedAt", "seenAt", "lastSeen", "checkedAt", "at", "sources"]);

const skip = (why) => (console.log(`skip build: ${why}`), process.exit(0));
const build = (why) => (console.log(`build: ${why}`), process.exit(1));
const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 512 * 2 ** 20 });

const ref = process.env.VERCEL_GIT_COMMIT_REF;
if (ref && ref !== "main") skip(`branch ${ref} doesn't deploy`);
if (/\[deploy\]/i.test(process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0] ?? "")) build("[deploy] in the subject");

const prev = process.env.VERCEL_GIT_PREVIOUS_SHA;
if (!prev) build("no previous deployment to compare with");

let changed;
try {
  changed = git("diff", "--name-only", prev, "HEAD").split("\n").filter(Boolean);
} catch {
  try {
    git("fetch", "--quiet", "--depth=100", "origin", prev);
    changed = git("diff", "--name-only", prev, "HEAD").split("\n").filter(Boolean);
  } catch {
    build("previous deployment's commit not in this clone");
  }
}

const inert = (f) => /^(docs\/|tests\/|\.github\/)/.test(f) || (/\.md$/i.test(f) && !f.startsWith("content/"));
const isData = (f) => f.startsWith("data/") && f.endsWith(".json");
const code = changed.filter((f) => !inert(f) && !isData(f));
if (code.length) build(`code or content changed (${code.slice(0, 3).join(", ")}${code.length > 3 ? ", …" : ""})`);
const data = changed.filter(isData);
if (!data.length) skip("only docs, tests or workflows changed");

const strip = (v) => {
  if (Array.isArray(v)) return v.map(strip);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([k]) => !VOLATILE.has(k)).map(([k, x]) => [k, strip(x)]));
  return v;
};
const read = (sha, f) => {
  try {
    return JSON.stringify(strip(JSON.parse(git("show", `${sha}:${f}`))));
  } catch {
    return null; // added, deleted or unreadable: counts as a change
  }
};
const material = data.find((f) => read(prev, f) === null || read(prev, f) !== read("HEAD", f));
if (!material) skip(`only timestamps changed in ${data.length} data file(s)`);

const ageH = (Date.now() / 1000 - Number(git("log", "-1", "--format=%ct", prev).trim())) / 3600;
if (ageH < DATA_GAP_H) skip(`prices changed (${material}), but the last deployment is ${ageH.toFixed(1)} h old (< ${DATA_GAP_H} h); the next price run ships them`);
build(`prices changed (${material}), last deployment ${ageH.toFixed(1)} h old`);
