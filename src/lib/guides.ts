// Evergreen guides: Markdown files in content/guides/<slug>.md with a small
// frontmatter block (title, description, updated). Rendered to HTML at build.
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";

const DIR = path.join(process.cwd(), "content", "guides");

export type Guide = { slug: string; title: string; description: string; updated: string; html: string; words: number };

function parse(slug: string, raw: string): Guide {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const meta: Record<string, string> = {};
  for (const line of (m?.[1] ?? "").split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  const body = m?.[2] ?? raw;
  // Site-internal links only (the writers' rule); anything else renders as text.
  const html = marked.parse(body, { async: false }) as string;
  return { slug, title: meta.title ?? slug, description: meta.description ?? "", updated: meta.updated ?? "", html: html.replace(/<a href="(?!\/)[^"]*">([\s\S]*?)<\/a>/g, "$1"), words: body.split(/\s+/).filter(Boolean).length };
}

let memo: Guide[] | null = null;
export function guides(): Guide[] {
  if (memo) return memo;
  memo = fs.existsSync(DIR)
    ? fs.readdirSync(DIR).filter((f) => f.endsWith(".md")).sort().map((f) => parse(f.slice(0, -3), fs.readFileSync(path.join(DIR, f), "utf8")))
    : [];
  return memo;
}
export const guide = (slug: string) => guides().find((g) => g.slug === slug) ?? null;
