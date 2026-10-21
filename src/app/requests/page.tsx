import type { Metadata } from "next";
import Link from "next/link";
import Requests from "@/components/community/Requests";
import { SITE_NAME } from "@/lib/site";

// A static shell: the intro is in the HTML; the board loads in the browser
// from the CDN-cached /api/community/requests.
export const metadata: Metadata = {
  title: "Feedback & requests",
  description: `Ask ${SITE_NAME} to track a store, add a camera or lens, or build a feature, and vote on what others asked for.`,
  alternates: { canonical: "/requests" },
};

export default function RequestsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">Feedback &amp; requests</h1>
      <p className="mt-2 text-sm text-muted">
        Ask for a store to track, a camera or lens to add, or a feature, and vote up the requests you want too. The site owner marks each one planned, done or
        won&apos;t do. For something private (a wrong price, a bug, a message only the owner should read) use the{" "}
        <Link href="/feedback" prefetch={false}>
          feedback form
        </Link>{" "}
        instead.
      </p>
      <div className="mt-4">
        <Requests />
      </div>
    </div>
  );
}
