// refresh-prices' commit job: copy each market job's data (incoming/market-<m>/…,
// paths relative to data/) into data/, and deep-merge the one shared file,
// data/amazon-asins.json, which every market job may have added to.
import fs from "node:fs";
import path from "node:path";

const IN = process.argv[2] ?? "incoming";
const SHARED = "amazon-asins.json";
const merge = (a: unknown, b: unknown): unknown =>
  a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)
    ? Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].map((k) => [k, k in b ? merge((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]) : (a as Record<string, unknown>)[k]]))
    : b ?? a;

const copy = (from: string, to: string) => {
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, e.name), d = path.join(to, e.name);
    if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copy(s, d); }
    else if (e.name !== SHARED || to !== "data") fs.copyFileSync(s, d);
  }
};

if (!fs.existsSync(IN)) { console.log("no market artifacts"); process.exit(0); }
let asins: unknown = fs.existsSync(path.join("data", SHARED)) ? JSON.parse(fs.readFileSync(path.join("data", SHARED), "utf8")) : undefined;
for (const dir of fs.readdirSync(IN).sort()) {
  const root = path.join(IN, dir);
  copy(root, "data");
  const a = path.join(root, SHARED);
  if (fs.existsSync(a)) asins = merge(asins, JSON.parse(fs.readFileSync(a, "utf8")));
  console.log(`merged ${dir}`);
}
if (asins !== undefined) fs.writeFileSync(path.join("data", SHARED), JSON.stringify(asins, null, 1) + "\n");
