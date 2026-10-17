import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm text-muted sm:grid-cols-3">
        <div>
          <p className="font-bold text-fg">{SITE_NAME}</p>
          <p className="mt-1">Prices from US retailers, specs from the makers&apos; own spec sheets.</p>
        </div>
        <nav className="flex flex-col gap-1">
          <Link href="/about">About &amp; methodology</Link>
          <Link href="/disclosure">Affiliate disclosure</Link>
          <Link href="/credits">Photo credits</Link>
        </nav>
        <p className="text-xs leading-relaxed">
          {SITE_NAME} earns a commission when you buy through some retailer links, at no cost to you. It never changes which
          price we show first: offers are always sorted by price. As an Amazon Associate we earn from qualifying purchases.
        </p>
      </div>
    </footer>
  );
}
