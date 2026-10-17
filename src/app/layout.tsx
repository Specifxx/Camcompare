import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import FeedbackButton from "@/components/FeedbackButton";
import Footer from "@/components/Footer";
import GeoSuggest from "@/components/GeoSuggest";
import Header from "@/components/Header";
import { SITE_NAME, SITE_TAGLINE, SITE_URL, VERIFY } from "@/lib/site";
import "./globals.css";
import { Caveat, Fraunces, JetBrains_Mono } from "next/font/google";

// Display face for headings and the wordmark: Fraunces, a soft "wonky" old-style
// serif (variable, with its SOFT/WONK axes) so the site reads like a photo
// magazine, not a SaaS page. Small labels, prices and EXIF-style metadata use
// JetBrains Mono. Body text stays on the system stack for readability.
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap", axes: ["SOFT", "WONK", "opsz"] });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
// Handwriting, used sparingly (the home page's notes and annotations, `.cc-hand`).
const hand = Caveat({ subsets: ["latin"], variable: "--font-hand", display: "swap", weight: ["500", "700"] });

// AdSense loads only when the owner sets NEXT_PUBLIC_ADSENSE_CLIENT (see AdSlot).
const ADSENSE = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME}: ${SITE_TAGLINE}`, template: `%s | ${SITE_NAME}` },
  description: "Compare camera and lens specs side by side and find the lowest new and used price at retailers in the US, UK, Europe, Australia and Singapore.",
  openGraph: { siteName: SITE_NAME, type: "website" },
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
    { media: "(prefers-color-scheme: light)", color: "#f4eee2" },
    { media: "(prefers-color-scheme: dark)", color: "#16120f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable} ${hand.variable}`}>
      {VERIFY.impact && (
        <head>
          {/* Impact reads the non-standard `value` attribute. */}
          <meta {...({ name: "impact-site-verification", value: VERIFY.impact } as object)} />
        </head>
      )}
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
          Skip to content
        </a>
        <Header />
        {/* Above the home hero's full-bleed background, which reaches up behind the header. */}
        <div className="relative z-20">
          <GeoSuggest />
        </div>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          {children}
        </main>
        <Footer />
        <FeedbackButton />
        <Analytics />
        {ADSENSE && <Script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE}`} crossOrigin="anonymous" strategy="lazyOnload" />}
      </body>
    </html>
  );
}
