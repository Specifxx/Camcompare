import type { Metadata } from "next";
import ThreadPage from "@/components/community/ThreadPage";

// The static shell every /community/t/<id> is served from (a rewrite in
// next.config.js), so a thread costs no build, no ISR write and no server
// render. Noindex: its content is rendered in the browser.
export const metadata: Metadata = {
  title: "Community thread",
  robots: { index: false, follow: true },
};

export default function ThreadShell() {
  return (
    <div className="mx-auto max-w-3xl">
      <ThreadPage />
    </div>
  );
}
