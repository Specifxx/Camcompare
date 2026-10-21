import type { Metadata } from "next";
import StoryPage from "@/components/community/StoryPage";

// The static shell every /stories/p/<id> is served from (a rewrite in
// next.config.js), so a story costs no build, no ISR write and no server
// render. No robots tag in the HTML on purpose: StoryPage adds noindex unless
// the owner featured the story (a noindex here would hide featured ones too).
export const metadata: Metadata = { title: "Member story" };

export default function StoryShell() {
  return (
    <div className="mx-auto max-w-3xl">
      <StoryPage />
    </div>
  );
}
