"use client";
// Every retailer link. Clicks are measured as a Vercel Analytics event (no
// database beacon — RiftCompare turned its own off for egress, 2026-07-23).
import { track } from "@vercel/analytics";
import { OUTBOUND_REL } from "@/lib/affiliate";

export default function OutboundLink({
  href,
  retailer,
  camera,
  placement,
  className,
  children,
}: {
  href: string;
  retailer: string;
  camera: string;
  placement: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      rel={OUTBOUND_REL}
      target="_blank"
      className={className}
      onClick={() => {
        try {
          track("buy_click", { retailer, camera, placement });
        } catch {
          /* analytics must never block the click */
        }
      }}
    >
      {children}
    </a>
  );
}
