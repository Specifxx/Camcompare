import type { MediaLink } from "@/lib/media-links";
import LinkGrid from "./LinkGrid";

/** Videos: YouTube searches and the maker's channel. No embeds until the catalog holds a specific video ID. */
export default function ProductVideos({ links, name }: { links: MediaLink[]; name: string }) {
  if (!links.length) return null;
  return (
    <section id="videos" className="scroll-mt-28" aria-labelledby="videos-h">
      <h2 id="videos-h" className="h-section mb-1">
        Videos
      </h2>
      <p className="mb-3 text-sm text-muted">Reviews, comparisons and sample footage of the {name}, on YouTube.</p>
      <LinkGrid links={links} icon="play" />
    </section>
  );
}
