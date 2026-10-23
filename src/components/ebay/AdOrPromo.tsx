// An ad position: the AdSense slot when the owner has configured one,
// otherwise our own "Shop on eBay" box (EbayPromo) with tagged searches
// for this page's market. Same positions as before, so the ad rules hold:
// never beside a buy button, never above a product's price.
import AdSlot from "../AdSlot";
import { adsenseOn } from "@/lib/ads";
import { ebayCategoryLinks, ebayLink, accessoryEbayCategory, type EbayLink } from "@/lib/ebay-links";
import type { MarketCode } from "@/lib/markets";
import EbayPromo from "./EbayPromo";

type Preset = "cameras" | "accessories";

function presetLinks(preset: Preset, m: MarketCode, page: string, placement: string): EbayLink[] {
  if (preset === "cameras") return ebayCategoryLinks(m, page, placement);
  const pick: [string, string, string][] = [
    ["tripods", "tripod", "Tripods & heads"],
    ["bags", "camera bag", "Camera bags"],
    ["batteries", "camera battery", "Camera batteries"],
    ["memory-cards", "memory card", "Memory cards"],
  ];
  return pick.map(([cat, q, label]) => ebayLink(m, { query: q, category: accessoryEbayCategory(cat, m) }, page, placement, label)).filter((l): l is EbayLink => l !== null);
}

export default function AdOrPromo({
  slot,
  market,
  page,
  placement,
  links = "cameras",
  title,
  note,
}: {
  slot: string | undefined;
  market: MarketCode;
  page: string;
  /** The customid's placement, "promo-<where>": EPN reports show which box earns. */
  placement: string;
  links?: Preset | EbayLink[];
  title?: string;
  note?: string;
}) {
  if (adsenseOn(slot)) return <AdSlot slot={slot} />;
  const list = Array.isArray(links) ? links : presetLinks(links, market, page, placement);
  return <EbayPromo links={list} product={page} placement={placement} title={title} note={note} />;
}
