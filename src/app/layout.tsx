import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { ShareArrival } from "@/components/ShareArrival";
import FeedbackButton from "@/components/FeedbackButton";
import { RateCard } from "@/components/site-reviews/RateCard";
import Footer from "@/components/Footer";
import GeoSuggest from "@/components/GeoSuggest";
import Header from "@/components/Header";
import { navData } from "@/lib/nav-data";
import HolidayStrip from "@/components/HolidayStrip";
import { saleStrip } from "@/lib/black-friday";
import Reveal from "@/components/Reveal";
import { SideRails } from "@/components/SideRails";
import { SITE_NAME, SITE_TAGLINE, SITE_URL, VERIFY } from "@/lib/site";
import "./globals.css";
// The cart list's styles (components/cart): imported here, never from a component, so node tests can load them.
import "@/components/cart/cart.css";
import "@/components/site-reviews/site-reviews.css";
import localFont from "next/font/local";
import { JetBrains_Mono } from "next/font/google";
import { SEASON_BOOT_SCRIPT, CHRISTMAS_FESTIVE_LAYER } from "@/lib/season";
import { MARKET_BOOT_SCRIPT } from "@/lib/market-boot";

// Inter for text, Bricolage Grotesque for headings and big figures (the same
// pair as Compare Empire), both self-hosted (OFL, from Fontsource) so a build
// never waits on Google Fonts. JetBrains Mono is only for the few spots that
// ask for font-mono.
const sans = localFont({ src: "./fonts/inter-latin-wght-normal.woff2", variable: "--font-sans", display: "swap", weight: "100 900" });
const display = localFont({ src: "./fonts/bricolage-grotesque-latin-wght-normal.woff2", variable: "--font-display", display: "swap", weight: "200 800" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

// AdSense loads only when the owner sets NEXT_PUBLIC_ADSENSE_CLIENT (see AdSlot).
const ADSENSE = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME}: ${SITE_TAGLINE}`, template: `%s | ${SITE_NAME}` },
  description: "Compare camera and lens specs side by side and find the lowest new and used price at retailers in the US, UK, Europe, Australia and Singapore.",
  openGraph: { siteName: SITE_NAME, type: "website" },
  // Large image previews and full snippets in Google (Search, Discover, Images), as RiftCompare does.
  // A page that sets its own `robots` (noindex) replaces this whole object.
  robots: { googleBot: { "max-image-preview": "large", "max-snippet": -1 } },
  verification: {
    ...(VERIFY.google ? { google: VERIFY.google } : {}),
    other: {
      ...(VERIFY.bing ? { "msvalidate.01": VERIFY.bing } : {}),
      ...(ADSENSE ? { "google-adsense-account": ADSENSE } : {}),
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0c12" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable}`} data-festive={CHRISTMAS_FESTIVE_LAYER ? "" : undefined} suppressHydrationWarning>
      <head>
        {/* Christmas (1 November to Boxing Day): data-season on <html> from the visitor's own date. lib/season.ts. */}
        <script dangerouslySetInnerHTML={{ __html: SEASON_BOOT_SCRIPT }} />
        {/* The visitor's own market (owner, 2026-11-01): a person, never a crawler, on another market's page goes to theirs. lib/market-boot.ts. */}
        <script dangerouslySetInnerHTML={{ __html: MARKET_BOOT_SCRIPT }} />
        <link rel="alternate" type="application/rss+xml" title="CamCompare guides" href="/feed.xml" />
        {/* Impact reads the non-standard `value` attribute. */}
        {VERIFY.impact && <meta {...({ name: "impact-site-verification", value: VERIFY.impact } as object)} />}
      </head>
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
          Skip to content
        </a>
        <Header nav={navData()} sale={saleStrip(new Date().toISOString().slice(0, 10))} />
        <HolidayStrip sale={saleStrip(new Date().toISOString().slice(0, 10))} />
        <GeoSuggest />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          {children}
        </main>
        <Footer />
        <FeedbackButton />
        {/* Rate us (owner, 2026-11-03): the corner card, asking only after real use; RiftCompare keeps the ratings. */}
        <RateCard />
        {/* eBay and Amazon side rails from 1280px, the eBay tiles in the phone dock below: browser only (components/SideRails.tsx). */}
        <SideRails />
        <Reveal />
        <Analytics />
        <ShareArrival />
        {ADSENSE && <Script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE}`} crossOrigin="anonymous" strategy="lazyOnload" />}
      </body>
    </html>
  );
}
