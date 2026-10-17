import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-extrabold">Not found</h1>
      <p className="mt-2 text-muted">That page doesn&apos;t exist, or the camera isn&apos;t in our catalog.</p>
      <Link prefetch={false} href="/cameras" className="btn-primary mt-6">Browse cameras</Link>
    </div>
  );
}
