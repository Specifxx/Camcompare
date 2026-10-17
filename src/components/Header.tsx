import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

const NAV = [
  { href: "/cameras", label: "Cameras" },
  { href: "/compare", label: "Compare" },
  { href: "/brands", label: "Brands" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 text-fg no-underline hover:no-underline">
          <svg aria-hidden width="26" height="26" viewBox="0 0 26 26" className="text-accent">
            <rect x="1" y="6" width="24" height="17" rx="4" fill="currentColor" />
            <rect x="8" y="2.5" width="10" height="5" rx="1.5" fill="currentColor" />
            <circle cx="13" cy="14.5" r="5.5" fill="rgb(var(--c-surface))" />
            <circle cx="13" cy="14.5" r="3" fill="currentColor" />
          </svg>
          <span className="text-base font-extrabold tracking-tight">{SITE_NAME}</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-muted hover:text-fg">
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
