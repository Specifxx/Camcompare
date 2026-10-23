import type { Metadata } from "next";
import MyGear from "@/components/collection/MyGear";
import { SITE_NAME } from "@/lib/site";
import { ebayTemplate } from "@/lib/ebay-links";
import { MARKET_CODES } from "@/lib/markets";

// Static: the list lives in the visitor's browser (and, signed in, their
// private account row); values come from the static /values/*.json.
export const metadata: Metadata = {
  title: "My gear: what your camera collection is worth",
  description: `Track the cameras and lenses you own like a portfolio: today's estimated used value, gain or loss on what you paid, and value over time, from ${SITE_NAME}'s used and new prices.`,
  alternates: { canonical: "/collection" },
};

export default function CollectionPage() {
  // Each item's "What it sells for on eBay": sold listings in the item's own market, tagged here at build.
  const ebaySold = Object.fromEntries(MARKET_CODES.flatMap((m) => {
    const t = ebayTemplate(m, { sold: true }, `gear-${m}`, "gear-ebay-sold");
    return t ? [[m, t]] : [];
  }));
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">My gear</h1>
      <p className="mt-2 text-sm text-muted">
        Your camera and lens collection, like a stock portfolio: add what you own and what you paid, and see what it&apos;s worth today from the used prices we track,
        whether it&apos;s up or down, and how its value has moved. No account needed; sign in to keep it on every device. Nobody else can see it.
      </p>
      <div className="mt-6">
        <MyGear ebaySold={ebaySold} />
      </div>
    </div>
  );
}
