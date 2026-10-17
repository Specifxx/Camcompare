"use client";
// "Prices last checked 3 hours ago". The page is static (built after each
// price import), so the server HTML carries the import's own time and the
// browser turns it into "N hours ago" against the visitor's clock.
import { useEffect, useState } from "react";
import { checkedAgo } from "./checked-ago";

export default function Freshness({ at, fallback }: { at: string; fallback: string }) {
  const [ago, setAgo] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setAgo(checkedAgo(at, Date.now()));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [at]);
  return <time dateTime={at}>{ago ?? fallback}</time>;
}
