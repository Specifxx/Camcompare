export const SITE_NAME = "CamCompare";
export const SITE_TAGLINE = "Camera prices and specs, side by side";
// The site's one contact address: owner notices go to it, emails sent to
// visitors reply to it, and the privacy page names it. It is in code, not a
// Vercel variable, so no personal address can stand in for it.
export const CONTACT_EMAIL = "camcompareapp@gmail.com";
// The canonical address: canonical URLs, the sitemap, og tags and JSON-LD all
// read it. NEXT_PUBLIC_SITE_URL can override it (a staging domain), but never
// with a *.vercel.app host: those are deployment addresses, and a canonical
// pointing at one tells Google the real site is elsewhere.
export const CANONICAL_ORIGIN = "https://www.camcompare.app";
const fromEnv = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
export const SITE_URL = fromEnv && !/\.vercel\.app$/i.test(fromEnv) ? fromEnv : CANONICAL_ORIGIN;
export const abs = (p: string) => `${SITE_URL}${p.startsWith("/") ? p : `/${p}`}`;

// Site-ownership codes, each from a Vercel variable so a new network or
// console needs no code change. Nothing renders until a real code is set: a
// placeholder fails the check silently.
const v = (k: string) => (process.env[k] || "").trim();
export const VERIFY = {
  google: v("GOOGLE_SITE_VERIFICATION"),
  bing: v("BING_SITE_VERIFICATION"),
  impact: v("IMPACT_SITE_VERIFICATION"),
};

// No page sets `revalidate`. Prices and specs change only through commits
// (the daily import commits data/), and every commit is a fresh build, so
// pages are plain static files: no ISR writes, no database, nothing to
// refresh between deploys. (RiftCompare paid ~$10/day in ISR writes and a
// Neon project every few days for freshness this design gets from one build.)

// The family list lives in lib/family-network.ts (FAMILY_SITES), the same file in every Compare Empire repo.
