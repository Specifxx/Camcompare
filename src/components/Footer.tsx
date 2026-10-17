import Link from "next/link";
import { MARKET_CODES, MARKETS } from "@/lib/markets";
import { SITE_NAME } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-muted sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-bold text-fg">{SITE_NAME}</p>
          <p className="mt-1">Camera and lens prices from retailers in five markets, specs from the makers&apos; own spec sheets.</p>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Markets">
          <p className="font-semibold text-fg">Prices for</p>
          {MARKET_CODES.map((m) => (
            <Link key={m} href={MARKETS[m].prefix || "/"}>
              {MARKETS[m].flag} {MARKETS[m].name}
            </Link>
          ))}
        </nav>
        <nav className="flex flex-col gap-1" aria-label="About">
          <p className="font-semibold text-fg">About</p>
          <Link href="/guides">Guides</Link>
          <Link href="/mounts">Camera systems</Link>
          <Link href="/about">How we price &amp; check specs</Link>
          <Link href="/disclosure">Affiliate disclosure</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/credits">Photo credits</Link>
          <Link href="/saved">Saved</Link>
        </nav>
        <p className="text-xs leading-relaxed">
          {SITE_NAME} earns a commission when you buy through some retailer links, at no cost to you. It never changes the order of offers, which are always sorted by price. As an Amazon Associate we earn from qualifying purchases.
        </p>
      </div>
    </footer>
  );
}
