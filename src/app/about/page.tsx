import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "About & methodology", alternates: { canonical: "/about" } };

export default function About() {
  return (
    <div className="max-w-2xl space-y-4 text-sm leading-relaxed">
      <h1 className="text-2xl font-extrabold tracking-tight">About {SITE_NAME}</h1>
      <p>
        {SITE_NAME} puts camera and lens spec sheets side by side and shows what each costs today, new, used and refurbished, at retailers in the
        United States, the United Kingdom, Europe, Australia and Singapore. It is free to use and has no paid placements.
      </p>
      <h2 className="h-section pt-2">Why {SITE_NAME} exists</h2>
      <p>
        About five years ago, Yves Yang borrowed $100 to buy a broken Sony camera, and resold it. Then he kept going, buying and reselling cameras and lenses, one
        after another, until he bought his first full-frame mirrorless camera and lenses. That&apos;s when he became a proper photographer.
      </p>
      <p>
        It was before AI, so he did every price calculation himself, in Google Sheets: what something was selling for, what it was worth used, and whether a deal was
        really a deal. Everything he has spent on cameras since has come from cameras. His collection is now worth at least $20k, probably up about 2x: &ldquo;like my
        stock portfolio&rdquo;.
      </p>
      <p>
        {SITE_NAME} is that spreadsheet, built for everyone: the price tracking he did by hand, for every camera and lens we list, every day, in five markets. And{" "}
        <Link href="/collection" prefetch={false}>My gear</Link> is the portfolio part: add what you own and see what it&apos;s worth today.
      </p>
      <h2 className="h-section pt-2">What we list</h2>
      <p>
        Cameras and lenses announced in 2012 or later: interchangeable-lens bodies, premium and travel compacts, action and 360° cameras and cinema
        cameras, plus lenses from the camera makers and the main independent lens makers. Older gear stays only when it is still sold new or still trades
        used in volume. Every product has a photo; one without a properly licensed photo isn&apos;t listed until it has one.
      </p>
      <h2 className="h-section pt-2">Where the specs come from</h2>
      <p>
        The makers&apos; own published specifications, checked twice: once when a product is added and again by a separate review against the maker&apos;s
        spec page. Where a maker doesn&apos;t publish a figure, or we couldn&apos;t verify it, we show a dash rather than a guess. Weights include battery and
        card; battery life is the CIPA rating using the rear screen.
      </p>
      <h2 className="h-section pt-2">Where the prices come from</h2>
      <p>
        Retailers&apos; own product feeds and official APIs, refreshed daily, in each market&apos;s currency. We never convert currencies. We match each
        listing to a product by barcode, then model number, then title, and refuse accessories, parts, and listings priced far below anything the product
        has sold for. &ldquo;Lowest&rdquo; prices count in-stock, body-only offers; kits with a lens are shown but never counted as the body price.
        Marketplace sellers may sell grey-market stock without a local warranty; authorized dealers are labelled.
      </p>
      <h2 className="h-section pt-2">Price history and deals</h2>
      <p>
        We record each product&apos;s lowest new and used price every day, per market. Deal labels compare today&apos;s price with that record (for
        example &ldquo;lowest in 90 days&rdquo;) and need two weeks of history before they appear.
      </p>
      <p>
        Some links earn us a commission. That never changes the order: offers are always sorted by price. See the{" "}
        <Link href="/disclosure">affiliate disclosure</Link> and <Link href="/privacy">privacy</Link> pages.
      </p>
    </div>
  );
}
