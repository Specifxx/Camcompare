"use client";
// Adds a product to the comparison by rewriting ?c=.
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ComparePicker({ base, options, current }: { base: string; options: { slug: string; label: string }[]; current: string[] }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  if (current.length >= 4) return null;
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (value) router.push(`${base}?c=${[...current, value].join(",")}`);
      }}
    >
      <select value={value} onChange={(e) => setValue(e.target.value)} aria-label="Add to the comparison" className="min-w-[240px] max-w-full rounded-lg border border-line bg-surface px-2 py-2 text-sm">
        <option value="">Add {current.length ? "another" : "a camera or lens"}…</option>
        {options.filter((o) => !current.includes(o.slug)).map((o) => (
          <option key={o.slug} value={o.slug}>{o.label}</option>
        ))}
      </select>
      <button type="submit" className="btn-primary" disabled={!value}>Add</button>
    </form>
  );
}
