"use client";
// Adds or swaps a camera on /compare by rewriting ?c=.
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ComparePicker({ options, current }: { options: { slug: string; label: string }[]; current: string[] }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  if (current.length >= 4) return null;
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (value) router.push(`/compare?c=${[...current, value].join(",")}`);
      }}
    >
      <select value={value} onChange={(e) => setValue(e.target.value)} aria-label="Add a camera" className="min-w-[220px] rounded-lg border border-line bg-surface px-2 py-2 text-sm">
        <option value="">Add a camera…</option>
        {options.filter((o) => !current.includes(o.slug)).map((o) => <option key={o.slug} value={o.slug}>{o.label}</option>)}
      </select>
      <button type="submit" className="btn-primary" disabled={!value}>Add</button>
    </form>
  );
}
