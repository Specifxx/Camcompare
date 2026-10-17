// Read side of data/amazon-asins.json (written by the Amazon source): a
// product's ASIN in a marketplace, so a "Check price" row can link straight
// to the product page instead of a search.
import fs from "node:fs";
import path from "node:path";

let memo: Record<string, Record<string, { asin: string | null }>> | null = null;
export function asinFor(slug: string, marketplace: string, fallback?: string): string | null {
  if (!memo) {
    const p = path.join(process.cwd(), "data", "amazon-asins.json");
    memo = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
  }
  return memo![marketplace]?.[slug]?.asin ?? (marketplace === "www.amazon.com" ? fallback ?? null : null);
}
