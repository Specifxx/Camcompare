// Reads the catalog from data/ at build time. Pages import from
// lib/catalog/index.ts, never from here directly, so the parse happens once.
import fs from "node:fs";
import path from "node:path";
import { brandSchema, cameraSchema, mountSchema, type Brand, type Camera, type Mount } from "./schema";

export const DATA_DIR = path.join(process.cwd(), "data");

export type CatalogIssue = { file: string; message: string };

export function readCameraFiles(dir = path.join(DATA_DIR, "cameras")): { cameras: Camera[]; issues: CatalogIssue[] } {
  const cameras: Camera[] = [];
  const issues: CatalogIssue[] = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    } catch (e) {
      issues.push({ file, message: `invalid JSON: ${(e as Error).message}` });
      continue;
    }
    const parsed = cameraSchema.safeParse(raw);
    if (!parsed.success) {
      for (const i of parsed.error.issues) issues.push({ file, message: `${i.path.join(".")}: ${i.message}` });
      continue;
    }
    if (`${parsed.data.slug}.json` !== file) issues.push({ file, message: `slug "${parsed.data.slug}" does not match file name` });
    cameras.push(parsed.data);
  }
  return { cameras, issues };
}

export function readBrands(): Brand[] {
  return brandSchema.array().parse(JSON.parse(fs.readFileSync(path.join(DATA_DIR, "brands.json"), "utf8")));
}

export function readMounts(): Mount[] {
  return mountSchema.array().parse(JSON.parse(fs.readFileSync(path.join(DATA_DIR, "mounts.json"), "utf8")));
}

/** Cross-file rules a single-file schema cannot see. */
export function crossCheck(cameras: Camera[], brands: Brand[], mounts: Mount[]): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  const slugs = new Set(cameras.map((c) => c.slug));
  const brandSlugs = new Set(brands.map((b) => b.slug));
  const mountBySlug = new Map(mounts.map((m) => [m.slug, m]));
  const aliasOwner = new Map<string, string>();
  for (const c of cameras) {
    const file = `${c.slug}.json`;
    if (!brandSlugs.has(c.brand)) issues.push({ file, message: `unknown brand "${c.brand}"` });
    if (c.mount) {
      const m = mountBySlug.get(c.mount);
      if (!m) issues.push({ file, message: `unknown mount "${c.mount}"` });
      else if (!m.formats.includes(c.specs.sensorFormat)) issues.push({ file, message: `${c.mount} has no ${c.specs.sensorFormat} bodies` });
    }
    for (const ref of [c.predecessor, c.successor, ...c.rivals]) {
      if (ref && !slugs.has(ref)) issues.push({ file, message: `references "${ref}", which is not in the catalog` });
    }
    if (c.rivals.includes(c.slug)) issues.push({ file, message: "lists itself as a rival" });
    for (const a of [...c.aliases, ...c.modelCodes]) {
      const key = a.toLowerCase().replace(/[^a-z0-9α]+/g, "");
      const owner = aliasOwner.get(key);
      if (owner && owner !== c.slug) issues.push({ file, message: `alias "${a}" also belongs to ${owner}` });
      aliasOwner.set(key, c.slug);
    }
  }
  for (const c of cameras) {
    if (c.successor) {
      const s = cameras.find((x) => x.slug === c.successor);
      if (s && s.predecessor !== c.slug) issues.push({ file: `${c.slug}.json`, message: `successor ${s.slug} does not name it as predecessor` });
    }
  }
  return issues;
}
