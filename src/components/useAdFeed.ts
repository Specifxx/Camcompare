"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useMarket } from "@/lib/market-client";
import type { Rails } from "@/lib/side-rails";

// The ad tiles for the visitor's market: the static /rails/<market> file (lib/side-rails.ts), fetched once per market in the browser.
// Used by the in-page ad block (InlineAds.tsx) and the phone dock (PhoneDock.tsx); never in the server HTML.
const loaded = new Map<string, Promise<Rails | null>>();
function load(market: string): Promise<Rails | null> {
  let p = loaded.get(market);
  if (!p) {
    p = fetch(`/rails/${market}`)
      .then((r) => (r.ok ? (r.json() as Promise<Rails>) : null))
      .catch(() => null);
    loaded.set(market, p);
  }
  return p;
}

/** `undefined` while loading, `null` when there is nothing to show. */
export function useAdFeed(enabled = true): Rails | null | undefined {
  const market = useMarket(usePathname() ?? "/");
  const [rails, setRails] = useState<Rails | null | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    load(market).then((r) => live && setRails(r));
    return () => {
      live = false;
    };
  }, [market, enabled]);
  if (!enabled) return undefined;
  return rails === undefined || rails === null ? rails : rails.market === market ? rails : undefined;
}
