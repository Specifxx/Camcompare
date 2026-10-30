// Reads the catalog from data/ at build time. Pages import from
// lib/catalog/index.ts, never from here directly, so the parse happens once.
import fs from "node:fs";
import path from "node:path";
import type { z } from "zod";
import { aliasKeys, normalizeGtin } from "../matching";
import { brandSchema, cameraSchema, lensSchema, mountSchema, type Brand, type Camera, type Lens, type Mount } from "./schema";

export const DATA_DIR = path.join(process.cwd(), "data");

export type CatalogIssue = { file: string; message: string };

function readDir<T extends { slug: string }>(dir: string, schema: z.ZodType<T>): { items: T[]; issues: CatalogIssue[] } {
  const items: T[] = [];
  const issues: CatalogIssue[] = [];
  if (!fs.existsSync(dir)) return { items, issues };
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    } catch (e) {
      issues.push({ file, message: `invalid JSON: ${(e as Error).message}` });
      continue;
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      for (const i of parsed.error.issues) issues.push({ file, message: `${i.path.join(".")}: ${i.message}` });
      continue;
    }
    if (`${parsed.data.slug}.json` !== file) issues.push({ file, message: `slug "${parsed.data.slug}" does not match file name` });
    items.push(parsed.data);
  }
  return { items, issues };
}

export function readCameraFiles(dir = path.join(DATA_DIR, "cameras")): { cameras: Camera[]; issues: CatalogIssue[] } {
  const { items, issues } = readDir(dir, cameraSchema as z.ZodType<Camera>);
  return { cameras: items, issues };
}

export function readLensFiles(dir = path.join(DATA_DIR, "lenses")): { lenses: Lens[]; issues: CatalogIssue[] } {
  const { items, issues } = readDir(dir, lensSchema as z.ZodType<Lens>);
  return { lenses: items, issues: issues.map((i) => ({ ...i, file: `lenses/${i.file}` })) };
}

export function readBrands(): Brand[] {
  return brandSchema.array().parse(JSON.parse(fs.readFileSync(path.join(DATA_DIR, "brands.json"), "utf8")));
}

export function readMounts(): Mount[] {
  return mountSchema.array().parse(JSON.parse(fs.readFileSync(path.join(DATA_DIR, "mounts.json"), "utf8")));
}

/** A GS1 check digit that adds up (GTIN-8, UPC-A, EAN-13, GTIN-14). */
export function validGtin(g: string): boolean {
  if (!/^(\d{8}|\d{12,14})$/.test(g)) return false;
  const d = [...g].map(Number);
  const check = d.pop()!;
  const sum = d.reverse().reduce((t, x, i) => t + x * (i % 2 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** Cross-file rules a single-file schema cannot see. */
export function crossCheck(cameras: Camera[], brands: Brand[], mounts: Mount[], lenses: Lens[] = []): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  const cameraSlugs = new Set(cameras.map((c) => c.slug));
  const lensSlugs = new Set(lenses.map((l) => l.slug));
  const brandSlugs = new Set(brands.map((b) => b.slug));
  const mountBySlug = new Map(mounts.map((m) => [m.slug, m]));
  // Names are matched against retailer titles of BOTH kinds, under the
  // matcher's own keys (brand words dropped; the title must name the brand).
  // Two products of one brand sharing a key would make both unmatchable.
  const aliasOwner = new Map<string, string>();
  const claim = (file: string, p: Camera | Lens) => {
    for (const key of aliasKeys(p)) {
      const owner = aliasOwner.get(`${p.brand}:${key}`);
      if (owner && owner !== p.slug) issues.push({ file, message: `name "${key}" also belongs to ${owner}` });
      aliasOwner.set(`${p.brand}:${key}`, p.slug);
    }
  };
  // A GTIN sends a feed row straight to its product, past every title check
  // (matching.ts): one left in a copied file would price the wrong product.
  const gtinOwner = new Map<string, string>();
  const claimGtins = (file: string, p: Camera | Lens) => {
    for (const g of p.gtins) {
      if (!validGtin(g)) issues.push({ file, message: `GTIN ${g} has a wrong check digit` });
      const owner = gtinOwner.get(normalizeGtin(g));
      if (owner && owner !== p.slug) issues.push({ file, message: `GTIN ${g} also belongs to ${owner}` });
      gtinOwner.set(normalizeGtin(g), p.slug);
    }
  };
  for (const s of cameraSlugs) if (lensSlugs.has(s)) issues.push({ file: `${s}.json`, message: "slug used by both a camera and a lens" });

  for (const c of cameras) {
    const file = `${c.slug}.json`;
    if (!brandSlugs.has(c.brand)) issues.push({ file, message: `unknown brand "${c.brand}"` });
    if (c.mount) {
      const m = mountBySlug.get(c.mount);
      if (!m) issues.push({ file, message: `unknown mount "${c.mount}"` });
      else if (!c.specs.sensorFormat || !m.formats.includes(c.specs.sensorFormat)) issues.push({ file, message: `${c.mount} has no ${c.specs.sensorFormat} bodies` });
    }
    for (const ref of [c.predecessor, c.successor, ...c.rivals]) {
      if (ref && !cameraSlugs.has(ref)) issues.push({ file, message: `references "${ref}", which is not in the catalog` });
    }
    if (c.rivals.includes(c.slug)) issues.push({ file, message: "lists itself as a rival" });
    claim(file, c);
    claimGtins(file, c);
  }
  for (const l of lenses) {
    const file = `lenses/${l.slug}.json`;
    if (!brandSlugs.has(l.brand)) issues.push({ file, message: `unknown brand "${l.brand}"` });
    for (const m of l.mounts) if (!mountBySlug.has(m)) issues.push({ file, message: `unknown mount "${m}"` });
    if (new Set(l.mounts).size !== l.mounts.length) issues.push({ file, message: "a mount is listed twice" });
    for (const ref of [l.predecessor, l.successor, ...l.rivals]) {
      if (ref && !lensSlugs.has(ref)) issues.push({ file, message: `references "${ref}", which is not in the catalog` });
    }
    if (l.rivals.includes(l.slug)) issues.push({ file, message: "lists itself as a rival" });
    claim(file, l);
    claimGtins(file, l);
  }
  for (const list of [cameras, lenses] as { slug: string; successor: string | null; predecessor: string | null }[][]) {
    const bySlug = new Map(list.map((x) => [x.slug, x]));
    for (const x of list) {
      const s = x.successor ? bySlug.get(x.successor) : undefined;
      if (s && s.predecessor !== x.slug) issues.push({ file: `${x.slug}.json`, message: `successor ${s.slug} does not name it as predecessor` });
    }
  }
  return issues;
}
