"use client";
// A price that may be shown only while it is fresh, with the time it was
// fetched: Amazon's rule for prices from its API (AMAZON_MAX_AGE_H). Pages are
// static, so the browser checks again: if no build has replaced the page in
// time, the price gives way to "See price" and the link still works.
import { useEffect, useState } from "react";

export const asOf = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

export default function TimedPrice({ text, seenAt, maxAgeH }: { text: string; seenAt: string; maxAgeH: number }) {
  const [stale, setStale] = useState(false);
  useEffect(() => setStale(Date.now() - Date.parse(seenAt) > maxAgeH * 3600_000), [seenAt, maxAgeH]);
  if (stale) return <span className="text-sm font-normal text-muted">See price</span>;
  return (
    <span>
      {text}
      <span className="block text-right text-[10px] font-normal text-subtle">as of {asOf(seenAt)}</span>
    </span>
  );
}
