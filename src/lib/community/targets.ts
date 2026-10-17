// Which discussion targets exist, and where each lives on the site. Server-only:
// products come from the catalog files, threads from the database.
import { product, productPath } from "../catalog";
import { threadVisible } from "./db";
import { threadPath, type Target } from "./rules";

/** Whether people may comment on this target: a published product, a visible thread, or any well-formed deal key. */
export async function targetExists(t: Target): Promise<boolean> {
  if (t.kind === "product") return product(t.slug) !== null;
  if (t.kind === "thread") return threadVisible(t.id);
  return true;
}

/** A site path for a target key ("product:sony-a7-iv" → "/cameras/sony-a7-iv"), and a name for it. */
export function targetLink(key: string): { href: string; label: string } {
  const [kind, rest] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
  if (kind === "product") {
    const p = product(rest);
    return p ? { href: `${productPath(p)}#discussion`, label: p.item.name } : { href: "/", label: rest };
  }
  if (kind === "thread") return { href: threadPath(rest), label: "a discussion thread" };
  return { href: "/deals", label: "a deal" };
}
