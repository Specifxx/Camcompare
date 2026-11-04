import type { Metadata } from "next";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";
import { MARKETS, MARKET_CODES } from "@/lib/markets";
import { RETAILERS } from "@/lib/retailers";
import { ListYourStore } from "@/components/ListYourStore";

// The store-owner page every Compare Empire site shares (owner, 2026-11-04).
export const metadata: Metadata = {
  title: "List your camera store, free",
  description: `Run a camera store? Get it listed on ${SITE_NAME}'s price comparison for free: buyers comparing cameras and lenses go straight to your product pages.`,
  alternates: { canonical: "/list-your-store" },
};

export default function ListYourStorePage() {
  const names = MARKET_CODES.map((m) => MARKETS[m].name);
  const markets = `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return (
    <div className="mx-auto max-w-2xl leading-relaxed">
      <ListYourStore
        site={SITE_NAME}
        what="cameras and lenses"
        markets={markets}
        storeCount={RETAILERS.filter((r) => r.authorized !== null).length}
        regions={MARKET_CODES.map((m) => [m.toUpperCase(), MARKETS[m].name])}
        email={CONTACT_EMAIL}
        platforms="Shopify stores, affiliate-network product feeds and shops with structured product data (schema.org) on their pages"
        pricesRule="a new camera or lens priced under 40% of its launch price is dropped as a likely mistake"
        suggestHref="/contact#suggest"
        buttonClassName="btn-primary"
      >
        <li><strong>Prices we are allowed to read.</strong> We never go past a bot wall, so a shop that blocks crawlers needs a feed or an affiliate network instead.</li>
      </ListYourStore>
    </div>
  );
}
