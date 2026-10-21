import type { Metadata } from "next";
import Stories from "@/components/community/Stories";
import { STORY_TAGS } from "@/lib/community/stories";
import { SITE_NAME } from "@/lib/site";

// A static shell: the intro is in the HTML (indexable); the stories load in
// the browser from the CDN-cached /api/community/stories.
export const metadata: Metadata = {
  title: "Member reviews & stories",
  description: `Hands-on camera and lens reviews, guides, first impressions and deal tips written by ${SITE_NAME} members who own the gear.`,
  alternates: { canonical: "/stories" },
};

export default function StoriesPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">Member reviews &amp; stories</h1>
      <p className="mt-2 text-sm text-muted">
        Long-form reviews and stories from members who own the gear: what they bought, what they shoot with it, what they&apos;d change and whether they&apos;d buy it
        again. {STORY_TAGS.map((t) => t.label).join(", ")}. Featured stories are ones the site owner has read and picked; every story is a member&apos;s own opinion, not{" "}
        {SITE_NAME}&apos;s, and never changes the order of prices.
      </p>
      <div className="mt-4">
        <Stories />
      </div>
    </div>
  );
}
