import type { ThingsToKnow as T } from "@/lib/things-to-know";

/** "Things to know": facts from the spec sheet and today's offers, then Good for / Not for, each with the spec behind it. */
export default function ThingsToKnow({ t, name }: { t: T; name: string }) {
  if (!t.facts.length) return null;
  return (
    <section id="things-to-know" className="scroll-mt-28" aria-labelledby="ttk-h">
      <h2 id="ttk-h" className="h-section mb-3">
        Things to know
      </h2>
      <div className="card grid grid-cols-1 gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <ul className="flex flex-col gap-2 text-[15px] leading-snug">
          {t.facts.map((f) => (
            <li key={f} className="flex gap-2.5">
              <span aria-hidden className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        {(t.goodFor.length > 0 || t.notFor.length > 0) && (
          <div className="flex flex-col gap-4 border-t border-line pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            {t.goodFor.length > 0 && <FitList title="Good for" items={t.goodFor} good />}
            {t.notFor.length > 0 && <FitList title="Not the best for" items={t.notFor} />}
            <p className="text-[11px] text-subtle">From the {name}&apos;s published specs, not from a review.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function FitList({ title, items, good = false }: { title: string; items: T["goodFor"]; good?: boolean }) {
  return (
    <div>
      <h3 className="mb-1.5 text-sm font-bold">{title}</h3>
      <ul className="flex flex-col gap-1.5 text-sm">
        {items.map((i) => (
          <li key={i.label} className="flex gap-2">
            <span aria-hidden className={`mt-px font-bold ${good ? "text-win" : "text-warn"}`}>
              {good ? "✓" : "–"}
            </span>
            <span>
              <span className="font-medium">{i.label}</span> <span className="text-subtle">({i.why})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
