import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "About & methodology", alternates: { canonical: "/about" } };

export default function About() {
  return (
    <div className="prose-sm max-w-2xl space-y-4 text-sm leading-relaxed">
      <h1 className="text-2xl font-extrabold tracking-tight">About {SITE_NAME}</h1>
      <p>{SITE_NAME} puts camera spec sheets side by side and shows what each camera costs today, new and used, across US retailers.</p>
      <h2 className="h-section pt-2">Which cameras we list</h2>
      <p>
        Interchangeable-lens and premium fixed-lens cameras announced in 2016 or later, plus a few older bodies that are still sold new or
        still trade in volume used. Every camera has a photo; one without a properly licensed photo isn&apos;t listed until it has one.
      </p>
      <h2 className="h-section pt-2">Where the specs come from</h2>
      <p>
        The manufacturers&apos; own published specifications. Where a maker doesn&apos;t publish a figure, or we haven&apos;t verified it, we
        show a dash rather than a guess. Weights include battery and card; battery life is the CIPA rating using the rear screen.
      </p>
      <h2 className="h-section pt-2">Where the prices come from</h2>
      <p>
        Retailers&apos; own product feeds and APIs, refreshed daily. We match each listing to a camera by barcode, then model number, then
        title, and reject accessories, parts, and listings priced far below anything the camera has sold for. &ldquo;Lowest&rdquo; prices count
        in-stock, body-only offers; kits with a lens are shown but never counted as the body price. Marketplace sellers on eBay and Amazon may
        sell grey-market stock without a US warranty; authorized dealers are labelled.
      </p>
      <p>
        Some links earn us a commission. That never changes the order: offers are always sorted by price. See the{" "}
        <Link href="/disclosure">affiliate disclosure</Link>.
      </p>
    </div>
  );
}
