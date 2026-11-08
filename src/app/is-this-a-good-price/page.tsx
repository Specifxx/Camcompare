import type { Metadata } from "next";
import Link from "next/link";
import { LinkChecker } from "@/components/LinkChecker";
import { SITE_NAME, abs } from "@/lib/site";

// /is-this-a-good-price (2026-11-08, the competitor scan's gap #7; the same checker runs on every sister site): a visitor
// pastes a camera store's product link and sees how its price compares with every store we read in that store's market,
// same condition. The copy and FAQ are static HTML; the checker is a client island that reads /check/<host>, a static
// file per store host written at the build (lib/link-check-index.ts). One page for every market: the store says which.
const PATH = "/is-this-a-good-price";

export const metadata: Metadata = {
  title: "Is this a good price? Camera and lens price checker",
  description: `Paste a camera store's link to a camera or lens and see if it's a good price against every store ${SITE_NAME} reads in that country: new, used and refurbished compared like for like. Free.`,
  alternates: { canonical: PATH },
};

const STEPS = [
  "Copy the address of the store's product page (in a phone browser: Share, then Copy).",
  "Paste it into the box. The checker looks it up straight away.",
  "Read the verdict and the cheapest and median in-stock prices beside it.",
  "If the page shows a different price now, type it to check again.",
];

const FAQS = [
  { q: "Which links does it work with?", a: `Product pages at any camera store ${SITE_NAME} reads, in the US, UK, EU, Australia and Singapore. It compares the price with the other stores in that store's market, in the same condition: new with new, used with used, a kit with kits. For Amazon, eBay and stores we don't read, it offers the closest cameras and lenses from our catalogue.` },
  { q: "Do you open the page I paste?", a: "No. The checker only reads the store's address and the product's part of the link, then looks it up in the listings we already read from that store." },
  { q: "Why is the store's price different from the page?", a: "We read stores a few times a day, so a price can change in between. Type the price the page shows now and the verdict updates." },
  { q: "What counts as a good price?", a: "The cheapest in-stock store price we found, or within 1% of it. Under the median (the middle in-stock store price) is fair; about the median is typical; above it, you can usually pay less elsewhere. Amazon and eBay are not counted as stores here." },
  { q: "Does it include shipping or tax?", a: "No. Every price is the store's own price before shipping, as the store lists it." },
];

export default function IsThisAGoodPricePage() {
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: abs("/") },
        { "@type": "ListItem", position: 2, name: "Is this a good price?", item: abs(PATH) },
      ],
    },
    { "@context": "https://schema.org", "@type": "FAQPage", url: abs(PATH), mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
  ];
  return (
    <div className="mx-auto max-w-3xl leading-relaxed">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <p className="eyebrow">Free tool</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Is this a good price?</h1>
      <p className="mt-2 text-muted">
        Paste the link to a camera or lens at any camera store and see how its price compares with the cheapest and the typical in-stock price at every
        other store we read in that country.
      </p>

      <LinkChecker />

      <section className="card mt-6 p-5">
        <h2 className="font-display text-lg font-bold">How to use it</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-muted">
          {STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      <section className="card mt-6 divide-y divide-line overflow-hidden">
        <h2 className="px-5 py-4 font-display text-lg font-bold">Frequently asked questions</h2>
        {FAQS.map((f) => (
          <div key={f.q} className="px-5 py-4">
            <h3 className="font-semibold">{f.q}</h3>
            <p className="mt-1 text-sm text-muted">{f.a}</p>
          </div>
        ))}
      </section>

      <p className="mt-6 text-sm text-muted">
        Looking for a bargain instead? <Link href="/deals" prefetch={false} className="font-semibold text-accent hover:underline">Today&apos;s deals</Link> lists the biggest drops.
      </p>
    </div>
  );
}
