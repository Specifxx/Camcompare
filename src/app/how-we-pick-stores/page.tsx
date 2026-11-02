import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";
import { RETAILERS } from "@/lib/retailers";
import { HowWePickStores } from "@/components/HowWePickStores";

// The store-vetting page every Compare Empire site shares (owner, 2026-11-02).
export const metadata: Metadata = {
  title: "How we pick stores",
  description: `How ${SITE_NAME} checks every camera store before listing it, keeps checking it, and how to report one.`,
  alternates: { canonical: "/how-we-pick-stores" },
};

export default function HowWePickPage() {
  const stores = RETAILERS.filter((r) => r.authorized !== null).map((r) => r.name);
  return (
    <div className="mx-auto max-w-2xl leading-relaxed">
      <HowWePickStores
        site={SITE_NAME}
        what="cameras and lenses"
        stores={stores}
        priceRule="A new camera or lens priced under 40% of its launch price is dropped automatically, and every listing must match one exact model."
        marketplaces="eBay and Amazon rows are marketplaces, not stores: they are labelled as ads, sit apart from the store rows and are never the best price. We don't vet the individual sellers there, so check a seller's feedback before you buy. Used and refurbished prices come from second-hand dealers and are marked as such."
        buttonClassName="btn-primary"
        suggestHref="/contact#suggest"
      />
    </div>
  );
}
