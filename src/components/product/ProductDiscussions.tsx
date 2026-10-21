import Link from "next/link";
import type { MediaLink } from "@/lib/media-links";
import DeferredComments from "./DeferredComments";
import LinkGrid from "./LinkGrid";

/**
 * Discussions & forums: Reddit searches in the subreddits that talk about it,
 * DPReview's forums, and our own members' comments on the product (loaded
 * when scrolled near, through the CDN-cached community API).
 */
export default function ProductDiscussions({ links, slug, name }: { links: MediaLink[]; slug: string; name: string }) {
  return (
    <section id="discussions" className="scroll-mt-28" aria-labelledby="disc-h">
      <h2 id="disc-h" className="h-section mb-1">
        Discussions &amp; forums
      </h2>
      <p className="mb-3 text-sm text-muted">What owners say about the {name} elsewhere, and here.</p>
      <LinkGrid links={links} icon="chat" />
      <div className="card mt-4 p-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-bold">On CamCompare</h3>
          <Link href="/community/gear-advice" className="text-sm">
            Ask on the Gear advice board →
          </Link>
        </div>
        <DeferredComments target={`product:${slug}`} />
        <p className="mt-3 text-[11px] text-subtle">Comments are members&apos; own opinions, not CamCompare&apos;s. Votes never change the order of prices.</p>
      </div>
    </section>
  );
}
