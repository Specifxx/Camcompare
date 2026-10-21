"use client";
// A YouTube video that costs one thumbnail until it's wanted: the page ships
// an <img> from i.ytimg.com and a play button; a click swaps in the player
// from youtube-nocookie.com (no YouTube cookies before the visitor asks).
import { useState } from "react";

export default function LiteYouTube({ id, title }: { id: string; title: string }) {
  const [on, setOn] = useState(false);
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
      {on ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <button type="button" onClick={() => setOn(true)} className="group absolute inset-0 h-full w-full" aria-label={`Play video: ${title}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail, not ours to optimise */}
          <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100" />
          <span aria-hidden className="absolute left-1/2 top-1/2 flex h-12 w-[4.25rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl bg-black/75 transition-colors group-hover:bg-[#f00]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
