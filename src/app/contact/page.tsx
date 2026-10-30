import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

// One page with the address on it, linked from every footer (owner, 2026-10-30:
// contact info really clear on every site). Static like every page.
export const metadata: Metadata = {
  title: "Contact us",
  description: `How to reach ${SITE_NAME}: email ${CONTACT_EMAIL} about a wrong price or spec, a missing camera or lens, a store, or anything else.`,
  alternates: { canonical: "/contact" },
};

const mail = (subject: string) => `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-xl space-y-4 leading-relaxed">
      <h1 className="text-2xl font-extrabold tracking-tight">Contact us</h1>
      <p>
        Email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold">
          {CONTACT_EMAIL}
        </a>
        . A person reads every message, usually within two working days.
      </p>
      <p>
        Prefer a form? The <Link href="/feedback" prefetch={false}>feedback form</Link> lands in the same inbox, and you can leave your email if
        you&apos;d like a reply.
      </p>
      <h2 className="h-section pt-2">What to write about</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <a href={mail("Wrong price or spec")}>A wrong price or spec</a>: the page, the store and what is right.
        </li>
        <li>
          <a href={mail("Missing camera or lens")}>A camera or lens we don&apos;t list</a>.
        </li>
        <li>
          <a href={mail("Store listing")}>Stores</a>: to be listed, to correct a listing, or to be removed.
        </li>
        <li>
          <a href={mail("Partnership or press")}>Press, partnerships and affiliate programmes</a>.
        </li>
        <li>
          <a href={mail("Privacy request")}>Privacy requests</a>, from the address you used with us (<Link href="/privacy" prefetch={false}>privacy</Link>).
        </li>
      </ul>
      <p className="text-sm text-muted">
        Ideas other members can vote on go on the public <Link href="/requests" prefetch={false}>feedback &amp; request board</Link>.
      </p>
    </div>
  );
}
