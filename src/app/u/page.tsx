import type { Metadata } from "next";
import Profile from "@/components/community/Profile";

// The static shell every /u/<username> is served from (a rewrite in
// next.config.js). Noindex: member pages are rendered in the browser.
export const metadata: Metadata = {
  title: "Member",
  robots: { index: false, follow: false },
};

export default function UserShell() {
  return (
    <div className="mx-auto max-w-3xl">
      <Profile />
    </div>
  );
}
