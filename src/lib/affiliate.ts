// Every outbound retailer link goes through `affiliateUrl`. Lessons carried
// over from RiftCompare (src/lib/affiliate.ts there):
//  - a sub-id on every link from day one, so a sale can be traced to the page
//    and placement that earned it;
//  - read ids with `||` so an empty variable never emits `tag=` / `campid=`;
//  - rel="sponsored nofollow" on every paid link, and a "Paid link" note next
//    to the link, not only in the footer (the EPN quality team checks).
//
// Amazon: one Associates tag per marketplace (AMAZON_TAG_US/UK/DE/AU/SG;
// AMAZON_ASSOCIATE_TAG is still read for the US). eBay: one EPN campaign
// (hard-coded below) with each site's rotation id. Every other
// retailer: AFFILIATE_DEEPLINK_<KEY> (key upper-cased, "-" → "_"), a template
// containing {url} and optionally {subid}. That covers Impact
// (`https://x.sjv.io/c/1/2/3?u={url}&subId1={subid}`), CJ
// (`https://www.anrdoezrs.net/click-PID-AID?url={url}&sid={subid}`), Awin
// (`https://www.awin1.com/cread.php?awinmid=M&awinaffid=A&clickref={subid}&ued={url}`),
// Involve Asia, AccessTrade and FlexOffers without a code change per network.
import { retailer } from "./retailers";

export const OUTBOUND_REL = "sponsored nofollow noopener noreferrer";

const env = (k: string) => (process.env[k] || "").trim();
const deeplinkEnv = (key: string) => `AFFILIATE_DEEPLINK_${key.toUpperCase().replace(/-/g, "_")}`;

export function amazonTag(retailerKey: string): string {
  const r = retailer(retailerKey);
  if (!r?.amazon) return "";
  return env(r.amazon.tagEnv) || (r.market === "us" ? env("AMAZON_ASSOCIATE_TAG") : "");
}
// The owner's eBay Partner Network campaign, one for every Compare site and
// hard-coded (owner, 2026-10-30): no variable overrides it. The `cc-` customid
// prefix tells CamCompare's clicks apart in EPN's report.
export const EBAY_CAMPAIGN_ID = "5339155912";
export const ebayCampaign = () => EBAY_CAMPAIGN_ID;

const slugPart = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

/**
 * "cc-<page>-<placement>", alphanumerics and dashes, at most 60 characters.
 * A long page is cut, never the placement: EPN's customid report groups
 * clicks by placement (product-ebay-used, acc-ebay…), so it must survive.
 */
export function subId(page: string, placement: string): string {
  const pl = slugPart(placement).slice(0, 40);
  const pg = slugPart(page).slice(0, Math.max(0, 60 - 4 - pl.length)).replace(/-+$/, "");
  return `cc-${pg ? `${pg}-` : ""}${pl}`.replace(/-+/g, "-").replace(/-$/, "");
}

const bareHost = (h: string) => h.replace(/^www\./, "");
const sameSite = (a: string, b: string) => bareHost(a) === bareHost(b) || a.endsWith(`.${bareHost(b)}`);

export function affiliateUrl(retailerKey: string, url: string, sub: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  const r = retailer(retailerKey);
  if (r?.amazon) {
    const tag = amazonTag(retailerKey);
    if (!tag || !sameSite(u.hostname, r.amazon.marketplace)) return url;
    u.searchParams.set("tag", tag);
    u.searchParams.set("ascsubtag", sub);
    return u.toString();
  }
  if (r?.ebay) {
    const campid = ebayCampaign();
    if (!campid || !sameSite(u.hostname, new URL(r.site).hostname)) return url;
    // eBay's own affiliate URLs (itemAffiliateWebUrl) are already tagged.
    if (!u.searchParams.has("campid")) {
      u.searchParams.set("mkevt", "1");
      u.searchParams.set("mkcid", "1");
      u.searchParams.set("mkrid", r.ebay.rotationId);
      u.searchParams.set("siteid", r.ebay.siteId);
      u.searchParams.set("campid", campid);
      u.searchParams.set("toolid", "10001");
    }
    u.searchParams.set("customid", sub);
    return u.toString();
  }
  const template = env(deeplinkEnv(retailerKey));
  if (!isTemplate(template)) return url;
  // Some feeds (CJ, Awin) already hand out tracking links: wrap only links to
  // the retailer's own site.
  if (r && !sameSite(u.hostname, new URL(r.site).hostname)) return url;
  if (/^[?&]/.test(template)) {
    for (const [k, v] of new URLSearchParams(template.slice(1))) u.searchParams.set(k, v.replaceAll("{subid}", sub));
    return u.toString();
  }
  return template.replaceAll("{url}", encodeURIComponent(url)).replaceAll("{subid}", encodeURIComponent(sub));
}

/**
 * True when a link to this retailer earns: decides the "Paid link" note.
 * Pass the link itself where there is one: an offer's URL can already be
 * tagged when it is stored (eBay's itemAffiliateWebUrl carries the campaign
 * the import ran with; network feeds hand out tracking links), and it earns
 * even when this build's environment lacks the id.
 */
export function isPaid(retailerKey: string, href?: string): boolean {
  const r = retailer(retailerKey);
  if (href && isTagged(href)) return true;
  if (r?.amazon) return Boolean(amazonTag(retailerKey));
  if (r?.ebay) return Boolean(ebayCampaign());
  return isTemplate(env(deeplinkEnv(retailerKey)));
}

// Click hosts of the affiliate networks: Awin, CJ, Impact, Rakuten, FlexOffers, Involve Asia.
const NETWORK_HOST = /(^|\.)(awin1\.com|anrdoezrs\.net|dpbolvw\.net|jdoqocy\.com|kqzyfj\.com|tkqlhce\.com|sjv\.io|pxf\.io|7eer\.net|evyy\.net|ojrq\.net|linksynergy\.com|flexlinkspro\.com|invol\.co)$/;

/** Does this URL already carry an affiliate id: an Amazon tag, an EPN campaign, or a network click host? */
function isTagged(href: string): boolean {
  try {
    const u = new URL(href);
    if (NETWORK_HOST.test(u.hostname)) return true;
    if (/(^|\.)amazon\./.test(u.hostname)) return Boolean(u.searchParams.get("tag"));
    if (/(^|\.)ebay\./.test(u.hostname)) return Boolean(u.searchParams.get("campid"));
    return false;
  } catch {
    return false;
  }
}

/** A usable deep-link template: wraps {url}, or appends "&k=v" parameters. */
const isTemplate = (t: string) => t.includes("{url}") || /^[?&][^=&]+=[^&]/.test(t);
