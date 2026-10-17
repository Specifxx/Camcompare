import type { Metadata } from "next";
import Threads from "@/components/community/Threads";
import { BOARDS, CAMEXPERT_KARMA, CAMEXPERT_MIN_ACCOUNT_DAYS } from "@/lib/community/rules";
import { SITE_NAME } from "@/lib/site";

// A static shell: the intro and board list are in the HTML (indexable); the
// threads load in the browser from /api/community/threads.
export const metadata: Metadata = {
  title: "Community: camera and lens discussion boards",
  description: `Ask about cameras and lenses, share deals and the story behind your shots, and get advice from other ${SITE_NAME} members.`,
  alternates: { canonical: "/community" },
};

export default function CommunityPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">Community</h1>
      <p className="mt-2 text-sm text-muted">
        Discussion boards for people buying and using cameras and lenses. Ask which body or lens to get, share a deal you found, or tell the story behind a shot. Upvotes on
        your comments and reviews earn CamKarma; {CAMEXPERT_KARMA} CamKarma and an account {CAMEXPERT_MIN_ACCOUNT_DAYS} days old earns the [CamExpert] badge. Sign in with
        your email: no password, and your email is never shown.
      </p>
      <ul className="mt-4 border-t border-line text-sm">
        {BOARDS.map((b) => (
          <li key={b.slug} className="border-b border-line py-2">
            <a href={`/community/${b.slug}`} className="font-semibold">
              {b.name}
            </a>
            <span className="text-muted"> · {b.blurb}</span>
          </li>
        ))}
      </ul>
      <h2 className="mt-8 text-lg font-semibold">Latest threads</h2>
      <div className="mt-2">
        <Threads board={null} />
      </div>
    </div>
  );
}
