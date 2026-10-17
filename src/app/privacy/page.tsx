import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy", alternates: { canonical: "/privacy" } };

export default function Privacy() {
  return (
    <div className="max-w-2xl space-y-4 text-sm leading-relaxed">
      <h1 className="text-2xl font-extrabold tracking-tight">Privacy</h1>
      <p>{SITE_NAME} has no accounts and stores nothing about you on our servers.</p>
      <h2 className="h-section pt-2">What stays in your browser</h2>
      <p>
        Your market choice (a cookie and local storage entry named <code>cc_market</code>) and your saved list (local storage). Clearing site data
        removes both. We use them only to show you the right prices and your list.
      </p>
      <h2 className="h-section pt-2">Analytics</h2>
      <p>
        We count page views and clicks on retailer links with Vercel Web Analytics, which uses no cookies and does not identify you. To suggest your
        country&apos;s prices we look up your country from your IP address when the page loads; the address isn&apos;t stored.
      </p>
      <h2 className="h-section pt-2">Retailers and affiliate links</h2>
      <p>
        When you follow a link to a retailer, that retailer (and the affiliate network that pays us a commission) may set its own cookies to credit the
        sale. Their privacy policies apply on their sites.
      </p>
      <h2 className="h-section pt-2">Advertising</h2>
      <p>
        We may show ads from Google AdSense. If we do, Google may use cookies to show ads; visitors in the UK and EU are asked for consent first. You can
        manage Google&apos;s ad personalisation at adssettings.google.com.
      </p>
    </div>
  );
}
