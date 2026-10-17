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
      <p>As an Amazon Associate we earn from qualifying purchases (Amazon.com, Amazon.co.uk, Amazon.de, Amazon.com.au and Amazon.sg).</p>
      <p>
        We are a member of the eBay Partner Network, and of retailer programmes run through affiliate networks such as Impact, Awin, CJ, Rakuten and
        Involve Asia. We may also show display advertising.
      </p>
      <p>Commissions and ads never affect which offers we show or their order. Offers are always sorted by price, and nobody can pay to appear first.</p>
    </div>
  );
}
