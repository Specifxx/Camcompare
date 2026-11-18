"use client";
// Every retailer link. Clicks are measured as a Vercel Analytics event (no
// database beacon — RiftCompare turned its own off for egress, 2026-07-23).
import { track } from "@vercel/analytics";
import { OUTBOUND_REL } from "@/lib/affiliate";
import { cartArmNow } from "@/lib/cart-list";
import { dockArmNow } from "@/lib/dock-arm";

export default function OutboundLink({
  href,
  retailer,
  product,
  placement,
  className,
  children,
}: {
  href: string;
  retailer: string;
  product: string;
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
          track("buy_click", { dock_arm: dockArmNow(), cart_arm: cartArmNow(), retailer, product, placement });
        } catch {
          /* analytics must never block the click */
        }
      }}
    >
      {children}
    </a>
  );
}
