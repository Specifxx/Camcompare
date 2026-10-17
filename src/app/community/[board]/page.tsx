import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Threads from "@/components/community/Threads";
import { BOARDS } from "@/lib/community/rules";

// One static page per board (the list is fixed); threads load in the browser.
export const dynamicParams = false;
export const generateStaticParams = () => BOARDS.map((b) => ({ board: b.slug }));

const find = (slug: string) => BOARDS.find((b) => b.slug === slug);

export function generateMetadata({ params }: { params: { board: string } }): Metadata {
  const b = find(params.board);
  if (!b) return {};
  return { title: `${b.name}: community board`, description: b.blurb, alternates: { canonical: `/community/${b.slug}` } };
}

export default function BoardPage({ params }: { params: { board: string } }) {
  const b = find(params.board);
  if (!b) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs text-muted">
        <a href="/community">Community</a> ›
      </p>
      <h1 className="text-2xl font-semibold">{b.name}</h1>
      <p className="mt-1 text-sm text-muted">{b.blurb}</p>
      <nav aria-label="Boards" className="mt-2 text-xs text-muted">
        {BOARDS.map((x, i) => (
          <span key={x.slug}>
            {i > 0 && " · "}
            {x.slug === b.slug ? <span className="font-semibold text-fg">{x.name}</span> : <a href={`/community/${x.slug}`}>{x.name}</a>}
          </span>
        ))}
      </nav>
      <div className="mt-4">
        <Threads board={b.slug} />
      </div>
    </div>
  );
}
