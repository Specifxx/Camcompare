import type { Metadata } from "next";
import StoryEditor from "@/components/community/StoryEditor";

// The editor: static, client-rendered, noindex (a form has nothing to rank for).
export const metadata: Metadata = {
  title: "Write a member story",
  robots: { index: false, follow: true },
};

export default function NewStoryPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-1 text-xs text-muted">
        <a href="/stories">Member stories</a>
      </p>
      <h1 className="text-2xl font-semibold">Write a story</h1>
      <p className="mt-2 text-sm text-muted">
        A hands-on review, a guide, first impressions, a deal tip or a comparison, about gear you&apos;ve used yourself. Headings, lists and a verdict help readers
        skim.
      </p>
      <div className="mt-4">
        <StoryEditor />
      </div>
    </div>
  );
}
