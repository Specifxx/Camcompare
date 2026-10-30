import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "Affiliate disclosure", alternates: { canonical: "/disclosure" } };

export default function Disclosure() {
  return (
    <div className="max-w-2xl space-y-4 text-sm leading-relaxed">
      <h1 className="text-2xl font-extrabold tracking-tight">Affiliate disclosure</h1>
      <p>
        {SITE_NAME} is free and reader-supported. When you click a retailer link and buy something, we may earn a commission from that retailer at no
        extra cost to you. Links that can earn us money are marked &ldquo;Paid link&rdquo; next to the link.
      </p>
      <section className="card space-y-2 p-4" aria-labelledby="epn">
        <h2 id="epn" className="font-semibold">eBay Partner Network</h2>
        <p>
          {SITE_NAME} is a member of the eBay Partner Network, eBay&apos;s affiliate programme. When you follow one of our links to eBay (eBay.com,
          eBay.co.uk, eBay.de or eBay.com.au) and buy something there, we earn a commission from eBay. It costs you nothing extra: the price on eBay is
          the same whether you arrive through our link or not.
        </p>
        <p>
          Our eBay links are searches (used, new, and recently sold listings) and, where eBay&apos;s data allows, individual listings. Each is marked
          &ldquo;Paid link&rdquo;. eBay sellers are individuals and businesses, not us: check a listing&apos;s condition, seller rating and returns
          before you buy.
        </p>
      </section>
      <p>As an Amazon Associate we earn from qualifying purchases (Amazon.com, Amazon.co.uk, Amazon.de, Amazon.com.au and Amazon.sg).</p>
      <p>
        We are also a member of retailer programmes run through affiliate networks such as Impact, Awin, CJ, Rakuten and Involve Asia. We may show
        display advertising; where no ad is set up, that space shows our own &ldquo;Shop on eBay&rdquo; links, labelled as paid.
      </p>
      <p>Commissions never affect which store offers we show or their order: store offers are always sorted by price, and no store can pay to move up. The one exception is that Amazon and eBay rows sit above the store offers on product pages and in quick views. They are labelled &ldquo;Ad&rdquo;, are paid links, and are never counted as a store or the best price.</p>
    </div>
  );
}
