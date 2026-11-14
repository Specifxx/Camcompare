import Link from "next/link";

// A friendly dead end (2026-11-14): the same words and the same first button, plus the other ways back in.
export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center sm:py-24">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-subtle">404</p>
      <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Not found</h1>
      <p className="mt-2 text-muted">That page doesn&apos;t exist, or the camera isn&apos;t in our catalog.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/cameras" className="btn-primary">Browse cameras</Link>
        <Link href="/lenses" className="btn-ghost">Lenses</Link>
        <Link href="/" className="btn-ghost">Home</Link>
      </div>
    </div>
  );
}
