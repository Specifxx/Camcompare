import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import FeedbackButton from "@/components/FeedbackButton";
import Footer from "@/components/Footer";
import GeoSuggest from "@/components/GeoSuggest";
import Header from "@/components/Header";
import Reveal from "@/components/Reveal";
import { SITE_NAME, SITE_TAGLINE, SITE_URL, VERIFY } from "@/lib/site";
import "./globals.css";
import { Inter, JetBrains_Mono } from "next/font/google";

// One clean sans for headings and body: Inter (globals.css points
// --font-display at it, so font-display is the same face). JetBrains Mono is
// only for the few spots that ask for font-mono.
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
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
    { media: "(prefers-color-scheme: light)", color: "#f8f8f7" },
    { media: "(prefers-color-scheme: dark)", color: "#111113" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
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
        <GeoSuggest />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          {children}
        </main>
        <Footer />
        <FeedbackButton />
        <Reveal />
        <Analytics />
        {ADSENSE && <Script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE}`} crossOrigin="anonymous" strategy="lazyOnload" />}
      </body>
    </html>
  );
}
