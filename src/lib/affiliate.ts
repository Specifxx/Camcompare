// Every outbound retailer link goes through `affiliateUrl`. Lessons carried
// over from RiftCompare (src/lib/affiliate.ts there):
//  - a sub-id on every link from day one, so a sale can be traced to the page
//    and placement that earned it;
//  - read ids with `||` so an empty variable never emits `tag=` / `campid=`;
//  - rel="sponsored nofollow" on every paid link, and the disclosure next to
//    the link, not only in the footer (the EPN quality team checks).
//
// Networks other than Amazon and eBay are configured with ONE variable per
// retailer: AFFILIATE_DEEPLINK_<KEY>, a template containing {url} and,
// optionally, {subid}. That covers Impact (`https://x.sjv.io/c/1/2/3?u={url}&subId1={subid}`),
// CJ (`https://www.anrdoezrs.net/click-PID-AID?url={url}&sid={subid}`),
// Awin (`https://www.awin1.com/cread.php?awinmid=M&awinaffid=A&clickref={subid}&ued={url}`)
// and FlexOffers without a code change per network.

import { retailer } from "./retailers";

export const OUTBOUND_REL = "sponsored nofollow noopener noreferrer";

const env = (k: string) => (process.env[k] || "").trim();

export const amazonTag = () => env("AMAZON_ASSOCIATE_TAG");
export const ebayCampaign = () => env("EBAY_AFFILIATE_CAMPAIGN");

/** "cc-<page>-<placement>", alphanumerics and dashes, at most 60 characters. */
export function subId(page: string, placement: string): string {
  return `cc-${page}-${placement}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").slice(0, 60);
}

export function affiliateUrl(retailerKey: string, url: string, sub: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  if (retailerKey === "amazon" || /(^|\.)amazon\.com$/.test(u.hostname)) {
    const tag = amazonTag();
    if (!tag) return url;
    u.searchParams.set("tag", tag);
    u.searchParams.set("ascsubtag", sub);
    return u.toString();
  }
  if (retailerKey === "ebay" || /(^|\.)ebay\.com$/.test(u.hostname)) {
    const campid = ebayCampaign();
    if (!campid) return url;
    // eBay's own affiliate URLs (itemAffiliateWebUrl) are already tagged.
    if (!u.searchParams.has("campid")) {
      u.searchParams.set("mkevt", "1");
      u.searchParams.set("mkcid", "1");
      u.searchParams.set("mkrid", "711-53200-19255-0");
      u.searchParams.set("siteid", "0");
      u.searchParams.set("campid", campid);
      u.searchParams.set("toolid", "10001");
    }
    u.searchParams.set("customid", sub);
    return u.toString();
  }
  const template = env(`AFFILIATE_DEEPLINK_${retailerKey.toUpperCase()}`);
  if (!template || !template.includes("{url}")) return url;
  // Some feeds (CJ, Awin) already hand out tracking links: wrap only links to
  // the retailer's own site.
  const own = retailer(retailerKey)?.site;
  if (own && !sameSite(u.hostname, new URL(own).hostname)) return url;
  return template.replaceAll("{url}", encodeURIComponent(url)).replaceAll("{subid}", encodeURIComponent(sub));
}

/** True when a link to this retailer earns: decides the "Paid link" tag. */
export function isPaid(retailerKey: string): boolean {
  if (retailerKey === "amazon") return Boolean(amazonTag());
  if (retailerKey === "ebay") return Boolean(ebayCampaign());
  return env(`AFFILIATE_DEEPLINK_${retailerKey.toUpperCase()}`).includes("{url}");
}

const sameSite = (a: string, b: string) => a.replace(/^www\./, "") === b.replace(/^www\./, "") || a.endsWith(`.${b.replace(/^www\./, "")}`);
