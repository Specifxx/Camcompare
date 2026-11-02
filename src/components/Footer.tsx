"use client";
// Client component for the same reason as the header: "Camera systems" and
// "Saved" are per-market pages, so they follow the page's market. No link
// prefetches: the footer is on every page and /credits alone is the size of
// the catalog.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MARKET_CODES, MARKETS, marketPath } from "@/lib/markets";
import { useMarket } from "@/lib/market-client";
import { CONTACT_EMAIL, FAMILY_SITES, SITE_NAME } from "@/lib/site";
import Logo from "./brand/Logo";

export default function Footer() {
  const here = useMarket(usePathname() ?? "/");
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 text-sm text-muted sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link href={marketPath(here, "/")} prefetch={false} className="text-fg no-underline hover:no-underline" aria-label={`${SITE_NAME} home`}>
            <Logo size={30} />
          </Link>
          <p className="mt-3">Camera and lens prices from shops in five markets, specs off the makers&apos; own sheets. Built for people who&apos;d rather be out shooting than comparing tabs.</p>
          <p className="mt-3 text-xs text-subtle">Prices checked daily</p>
          <p className="mt-3">
            <Link href="/contact" prefetch={false} className="font-semibold">Contact us</Link>:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Markets">
          <p className="eyebrow mb-1 text-subtle">Prices for</p>
          {MARKET_CODES.map((m) => (
            <Link key={m} href={MARKETS[m].prefix || "/"} prefetch={false}>
              {MARKETS[m].flag} {MARKETS[m].name}
            </Link>
          ))}
        </nav>
        <nav className="flex flex-col gap-1" aria-label="About">
          <p className="eyebrow mb-1 text-subtle">About</p>
          <Link href="/guides" prefetch={false}>Guides</Link>
          <Link href="/community" prefetch={false}>Community</Link>
          <Link href="/stories" prefetch={false}>Member stories</Link>
          <Link href="/collection" prefetch={false}>My gear</Link>
          <Link href={marketPath(here, "/releases")} prefetch={false}>Just announced</Link>
          <Link href={marketPath(here, "/viral-cameras")} prefetch={false}>Viral cameras</Link>
          <Link href={marketPath(here, "/digicams")} prefetch={false}>Digicams</Link>
          <Link href={marketPath(here, "/drones")} prefetch={false}>Drones</Link>
          <Link href={marketPath(here, "/smart-glasses")} prefetch={false}>Smart glasses</Link>
          <Link href="/requests" prefetch={false}>Feedback &amp; requests</Link>
          <Link href={marketPath(here, "/cameras")} prefetch={false}>All cameras</Link>
          <Link href={marketPath(here, "/lenses")} prefetch={false}>All lenses</Link>
          <Link href={marketPath(here, "/brands")} prefetch={false}>Brands</Link>
          <Link href={marketPath(here, "/mounts")} prefetch={false}>Camera systems</Link>
          <Link href="/world" prefetch={false}>Prices around the world</Link>
          <Link href="/about" prefetch={false}>How we price &amp; check specs</Link>
          <Link href="/disclosure" prefetch={false}>Affiliate disclosure</Link>
          <Link href="/contact" prefetch={false}>Contact us</Link>
          <Link href="/contact#suggest" prefetch={false}>Suggest a store</Link>
          <Link href="/feedback" prefetch={false}>Send feedback</Link>
          <Link href="/privacy" prefetch={false}>Privacy</Link>
          <Link href="/credits" prefetch={false}>Photo credits</Link>
          <Link href={marketPath(here, "/saved")} prefetch={false} rel="nofollow">Saved</Link>
          <Link href={marketPath(here, "/board")} prefetch={false}>Deals board (plain HTML)</Link>
          <Link href={marketPath(here, "/black-friday")} prefetch={false}>Black Friday deals</Link>
          <Link href="/price-report" prefetch={false}>Monthly price report</Link>
          <Link href="/widgets" prefetch={false}>Free price links</Link>
        </nav>
        <div className="text-xs leading-relaxed">
          <p>
            <Link href="/disclosure" prefetch={false} className="font-semibold">
              We earn from qualifying purchases through affiliate links, including eBay Partner Network
            </Link>
            , at no cost to you. As an Amazon Associate we earn from qualifying purchases.
          </p>
          <p className="mt-2">Store offers are always sorted by price. The one exception: Amazon and eBay rows sit above them on product pages, labelled &ldquo;Ad&rdquo;, and are never counted as the best price.</p>
        </div>
      </div>
      <nav aria-label="The Compare Empire family" className="mx-auto max-w-6xl border-t border-line px-4 py-6 text-xs text-subtle">
        <p className="eyebrow mb-2">More price comparison · the Compare Empire family</p>
        <ul className="flex flex-wrap gap-x-5 gap-y-1">
          {FAMILY_SITES.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener" className="font-semibold text-muted">
                {s.anchor}
              </a>{" "}
              on {s.name}
            </li>
          ))}
        </ul>
      </nav>
    </footer>
  );
}
