import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "Affiliate disclosure", alternates: { canonical: "/disclosure" } };

export default function Disclosure() {
  return (
    <div className="max-w-2xl space-y-4 text-sm leading-relaxed">
      <h1 className="text-2xl font-extrabold tracking-tight">Affiliate disclosure</h1>
      <p>
        {SITE_NAME} is reader-supported. When you click a retailer link and buy something, we may earn a commission from that retailer at no extra
        cost to you. Links that can earn us money are marked &ldquo;Paid link&rdquo; next to the link.
      </p>
      <p>As an Amazon Associate we earn from qualifying purchases.</p>
      <p>
        We are a member of the eBay Partner Network and of affiliate programs run through networks such as Impact, CJ and Awin. Commissions never
        affect which offers we show or their order, which is always by price.
      </p>
    </div>
  );
}
