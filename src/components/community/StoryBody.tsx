"use client";
// A story body: the Markdown subset (lib/community/stories.ts) rendered as
// React elements. Text is always a text node; links are http(s) only, with
// rel="nofollow ugc noopener noreferrer". No HTML from members is ever
// inserted.
import { Fragment } from "react";
import { parseStory, type Inline } from "@/lib/community/stories";

function Runs({ xs }: { xs: Inline[] }) {
  return (
    <>
      {xs.map((x, i) =>
        x.t === "text" ? (
          <Fragment key={i}>{x.v}</Fragment>
        ) : x.t === "code" ? (
          <code key={i} className="rounded bg-raised px-1 font-mono text-[0.9em]">
            {x.v}
          </code>
        ) : x.t === "b" ? (
          <strong key={i}>
            <Runs xs={x.c} />
          </strong>
        ) : x.t === "i" ? (
          <em key={i}>
            <Runs xs={x.c} />
          </em>
        ) : (
          <a key={i} href={x.href} rel="nofollow ugc noopener noreferrer" target="_blank" className="break-words">
            <Runs xs={x.c} />
          </a>
        ),
      )}
    </>
  );
}

function Lines({ lines }: { lines: Inline[][] }) {
  return (
    <>
      {lines.map((l, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          <Runs xs={l} />
        </Fragment>
      ))}
    </>
  );
}

export default function StoryBody({ text }: { text: string }) {
  const blocks = parseStory(text);
  return (
    <div className="space-y-3 break-words text-[15px] leading-relaxed">
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h2":
            return (
              <h2 key={i} className="pt-2 text-lg font-semibold">
                <Runs xs={b.c} />
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} className="pt-1 font-semibold">
                <Runs xs={b.c} />
              </h3>
            );
          case "p":
            return (
              <p key={i}>
                <Lines lines={b.lines} />
              </p>
            );
          case "quote":
            return (
              <blockquote key={i} className="border-l-2 border-line pl-3 text-muted">
                <Lines lines={b.lines} />
              </blockquote>
            );
          case "ul":
            return (
              <ul key={i} className="list-disc space-y-1 pl-5">
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Runs xs={it} />
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="list-decimal space-y-1 pl-5">
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Runs xs={it} />
                  </li>
                ))}
              </ol>
            );
          case "hr":
            return <hr key={i} className="border-line" />;
        }
      })}
    </div>
  );
}
