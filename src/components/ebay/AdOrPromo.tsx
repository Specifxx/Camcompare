// An ad position: the AdSense slot when the owner has configured one, otherwise THE in-page ad block (InlineAds: six eBay then Amazon
// tiles, native to the site; owner, 2026-11-13, in place of the side rails and the "Shop on eBay" boxes). The ad rules hold: one per
// page, never beside a buy button, never above a product's price, no interstitials.
import AdSlot from "../AdSlot";
import InlineAds from "../InlineAds";
import { adsenseOn } from "@/lib/ads";

export default function AdOrPromo({ slot }: { slot: string | undefined }) {
  if (adsenseOn(slot)) return <AdSlot slot={slot} />;
  return <InlineAds />;
}
