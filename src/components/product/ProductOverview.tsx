import Link from "next/link";
import type { Overview } from "@/lib/overview";

/** "Overview": the product in sentences, from its data (lib/overview.ts). Server-rendered text, links in it. */
export default function ProductOverview({ o, name }: { o: Overview; name: string }) {
  if (!o.length) return null;
  return (
    <section id="overview" className="scroll-mt-28" aria-labelledby="overview-h">
      <h2 id="overview-h" className="h-section mb-3">
        {name} overview
      </h2>
      <div className="flex max-w-3xl flex-col gap-2.5 text-[15px] leading-relaxed">
        {o.map((p, i) => (
          <p key={i}>
            {p.map((s, j) =>
              typeof s === "string" ? (
                s
              ) : (
                <Link key={j} href={s.href} prefetch={false} rel={s.nofollow ? "nofollow" : undefined}>
                  {s.text}
                </Link>
              ),
            )}
          </p>
        ))}
      </div>
    </section>
  );
}
