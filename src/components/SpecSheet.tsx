import type { SpecGroup } from "@/lib/specs/definitions";

export default function SpecSheet<T>({ item, groups }: { item: T; groups: SpecGroup<T>[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map((g) => ({ ...g, specs: g.specs.filter((d) => !d.optional || d.format(item) !== null) })).filter((g) => g.specs.length > 0).map((g) => (
        <div key={g.id} className="card overflow-hidden">
          <h3 className="bg-raised px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted">{g.title}</h3>
          <dl className="divide-y divide-line text-sm">
            {g.specs.map((d) => (
              <div key={d.key} className="grid grid-cols-[45%_1fr] gap-2 px-4 py-2">
                <dt className="text-muted">{d.label}</dt>
                <dd>{d.format(item) ?? <span className="text-subtle">—</span>}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
