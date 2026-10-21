import type { Metadata } from "next";
import Link from "next/link";
import FeedbackForm from "@/components/FeedbackForm";
import { SITE_NAME } from "@/lib/site";

// Static like every page. Noindex: a form has nothing to rank for, and it
// stays out of the sitemap.
export const metadata: Metadata = {
  title: "Feedback",
  description: `Tell ${SITE_NAME} about a wrong price or spec, a bug, a missing camera or lens, or an idea.`,
  alternates: { canonical: "/feedback" },
  robots: { index: false, follow: true },
};

export default function FeedbackPage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-extrabold tracking-tight">Tell us what to fix or add</h1>
      <p className="mt-2 text-muted">
        Spotted a wrong price or spec, a bug, or a camera or lens we don&apos;t list yet? Have an idea? Every message goes straight to the people who run{" "}
        {SITE_NAME}, and we read all of them.
      </p>
      <p className="mt-2 text-sm text-muted">
        Want a store tracked, a camera added or a new feature? Post it on the public{" "}
        <Link href="/requests" prefetch={false}>
          feedback &amp; request board
        </Link>{" "}
        so other members can vote for it. This form stays private.
      </p>
      <div className="mt-6">
        <FeedbackForm connected={Boolean(process.env.DATABASE_URL?.trim())} />
      </div>
      <p className="mt-4 text-xs leading-relaxed text-subtle">
        We keep your message, the page and market it&apos;s about, your browser type, and your email only if you give one, which we use only to reply.
        Nothing you send here is published. <Link href="/privacy" prefetch={false}>Privacy</Link>
      </p>
    </div>
  );
}
