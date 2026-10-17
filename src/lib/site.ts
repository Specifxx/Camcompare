export const SITE_NAME = "CamCompare";
export const SITE_TAGLINE = "Camera prices and specs, side by side";
// Set NEXT_PUBLIC_SITE_URL on Vercel once the domain is chosen; canonical
// URLs, the sitemap and JSON-LD all read it.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
export const abs = (p: string) => `${SITE_URL}${p.startsWith("/") ? p : `/${p}`}`;

// No page sets `revalidate`. Prices and specs change only through commits
// (the daily import commits data/), and every commit is a fresh build, so
// pages are plain static files: no ISR writes, no database, nothing to
// refresh between deploys. (RiftCompare paid ~$10/day in ISR writes and a
// Neon project every few days for freshness this design gets from one build.)
