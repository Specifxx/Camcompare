import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy", alternates: { canonical: "/privacy" } };

export default function Privacy() {
  return (
    <div className="max-w-2xl space-y-4 text-sm leading-relaxed">
      <h1 className="text-2xl font-extrabold tracking-tight">Privacy</h1>
      <p>
        We store only three things on our servers, each only if you choose to: feedback (your message, the page and market it&apos;s about, your
        browser type, and your email only if you give one, used only to reply), price alerts, and a community account if you join the community.
      </p>
      <h2 className="h-section pt-2">Community accounts</h2>
      <p>
        To comment, review, vote or post on the boards you sign in with an emailed link. We keep your email address (to sign you in; it is never shown
        to anyone), the username you pick, what you post and your votes. Comments, reviews, threads and your username are public. A sign-in cookie
        (<code>cc_session</code>, with <code>cc_member</code> beside it) keeps you signed in for 30 days; signing out removes both. To limit abuse we
        keep a one-way scrambled form of the IP address that asked for a sign-in link, never the address itself, and delete it after two days.
        To delete your account and everything you posted, use the feedback form with the email you signed in with.
      </p>
      <h2 className="h-section pt-2">Price alerts</h2>
      <p>
        When you use &ldquo;Track this price&rdquo;, we keep your email address, the product, market and condition, your target price, and the last price
        we emailed you about. We first send one email asking you to confirm; nothing else is sent until you click it. After that we email you only when
        that price drops, at most once a day per alert. Every email has a link to stop that alert and to see and remove all of yours; removed alerts are
        never emailed again. Emails are sent through Resend, our email provider. We never use your address for anything else and never share or sell it.
      </p>
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
