"use client";
// My gear (/collection): the visitor's cameras and lenses, today's estimated
// value of each and of the lot, gain or loss against what they paid, and
// the value over time. Kept in this browser (localStorage) when signed out;
// signed in, also in the member's private community_collection row, so it
// follows them across devices. Values are static JSON from the build
// (public/values, scripts/build-values.ts), in each market's own currency.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  conditionLabel,
  estimate,
  gainOf,
  GEAR_CONDITIONS,
  GEAR_NOTES_MAX,
  localSyncedWith,
  newGearId,
  parsePaid,
  portfolioSeries,
  readLocalGear,
  resolveSync,
  sellHint,
  setLocalSyncedWith,
  totals,
  writeLocalGear,
  type GearCondition,
  type GearItem,
  type SeriesFile,
  type ValuesFile,
} from "@/lib/collection";
import { MARKET_CODES, MARKETS, money, type MarketCode } from "@/lib/markets";
import { useMarket } from "@/lib/market-client";
import type { SearchRow } from "@/lib/search";
import { api, inputClass, linkButton, useMe } from "../community/client";
import { SignInBox } from "../community/bits";
import ProductPicker, { productHref, useCatalogIndex } from "../ProductPicker";
import GearChart from "./GearChart";

type Sync = "local" | "loading" | "saving" | "saved" | "error";

const valuesCache = new Map<string, Promise<unknown>>();
function getJson<T>(url: string): Promise<T | null> {
  if (!valuesCache.has(url))
    valuesCache.set(
      url,
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    );
  return valuesCache.get(url) as Promise<T | null>;
}

const signed = (minor: number, cur: Parameters<typeof money>[1]) => `${minor > 0 ? "+" : minor < 0 ? "−" : ""}${money(Math.abs(minor), cur, true)}`;
const today = () => new Date().toISOString().slice(0, 10);

function Gain({ abs, pct, cur }: { abs: number; pct: number | null; cur: Parameters<typeof money>[1] }) {
  return (
    <span className={`price font-semibold ${abs > 0 ? "text-win" : abs < 0 ? "text-warn" : "text-muted"}`}>
      {signed(abs, cur)}
      {pct !== null && <span className="font-normal"> ({pct > 0 ? "+" : ""}{pct}%)</span>}
    </span>
  );
}

function ItemForm({ row, market, initial, onSave, onCancel }: { row: SearchRow | null; market: MarketCode; initial?: GearItem; onSave: (it: Omit<GearItem, "id" | "updatedAt" | "slug" | "market">) => void; onCancel: () => void }) {
  const cur = MARKETS[initial?.market ?? market].currency;
  const [condition, setCondition] = useState<GearCondition>(initial?.condition ?? "good");
  const [paid, setPaid] = useState(initial?.paid != null ? String(initial.paid / 100) : "");
  const [bought, setBought] = useState(initial?.bought ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [err, setErr] = useState("");
  return (
    <form
      className="mt-2 grid gap-2 rounded-md border border-line bg-surface p-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const p = parsePaid(paid);
        if (p === undefined) return setErr(`Write the price as a number, like 1299 or 1299.50 (${cur}).`);
        if (bought && bought > today()) return setErr("The date bought can't be in the future.");
        onSave({ condition, paid: p, bought: bought || null, notes: notes.trim().slice(0, GEAR_NOTES_MAX) });
      }}
    >
      {row && <p className="font-semibold sm:col-span-2">{row.n}</p>}
      <label className="text-sm">
        <span className="font-semibold">Condition</span>
        <select value={condition} onChange={(e) => setCondition(e.target.value as GearCondition)} className={`${inputClass} mt-1`}>
          {GEAR_CONDITIONS.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="font-semibold">Price paid ({cur})</span>
        <input value={paid} onChange={(e) => setPaid(e.target.value)} inputMode="decimal" placeholder="optional" className={`${inputClass} mt-1`} />
      </label>
      <label className="text-sm">
        <span className="font-semibold">Date bought</span>
        <input type="date" value={bought} max={today()} onChange={(e) => setBought(e.target.value)} className={`${inputClass} mt-1`} />
      </label>
      <label className="text-sm">
        <span className="font-semibold">Notes</span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={GEAR_NOTES_MAX} placeholder="Serial, shutter count, where from…" className={`${inputClass} mt-1`} />
      </label>
      {err && <p role="alert" className="text-xs text-warn sm:col-span-2">{err}</p>}
      <div className="flex gap-3 sm:col-span-2">
        <button type="submit" className="btn-primary px-3 py-1.5 text-sm">
          {initial ? "Save" : "Add to my gear"}
        </button>
        <button type="button" onClick={onCancel} className={linkButton}>
          cancel
        </button>
      </div>
    </form>
  );
}

export default function MyGear() {
  const { user, loaded } = useMe();
  const visitor = useMarket(usePathname() ?? "/collection");
  const [market, setMarket] = useState<MarketCode | null>(null);
  const m = market ?? visitor;
  const index = useCatalogIndex();
  const [items, setItems] = useState<GearItem[]>([]);
  const [ready, setReady] = useState(false);
  const [sync, setSync] = useState<Sync>("local");
  const [syncErr, setSyncErr] = useState("");
  const [picked, setPicked] = useState<SearchRow | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [values, setValues] = useState<Partial<Record<MarketCode, ValuesFile>>>({});
  const [series, setSeries] = useState<Record<string, SeriesFile | undefined>>({});
  const syncKey = user ? user.username ?? `u:${user.createdAt}` : null;
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setItems(readLocalGear());
    setReady(true);
  }, []);

  // Signed in: the account's list, merged once with a browser that never synced.
  useEffect(() => {
    if (!loaded || !syncKey) return;
    setSync("loading");
    void api<{ items: GearItem[] }>("/api/community/collection").then(async (r) => {
      if (!r.ok) {
        setSync("error");
        setSyncErr(r.error);
        return;
      }
      const res = resolveSync(readLocalGear(), r.items, localSyncedWith(), syncKey);
      setItems(res.items);
      writeLocalGear(res.items);
      if (res.push) {
        const w = await api<{ items: GearItem[] }>("/api/community/collection", { method: "PUT", body: { items: res.items } });
        if (!w.ok) {
          setSync("error");
          setSyncErr(w.error);
          return;
        }
      }
      setLocalSyncedWith(syncKey);
      setSync("saved");
    });
  }, [loaded, syncKey]);

  const commit = useCallback(
    (next: GearItem[]) => {
      setItems(next);
      writeLocalGear(next);
      if (!syncKey || sync === "loading") return;
      setSync("saving");
      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(async () => {
        const w = await api("/api/community/collection", { method: "PUT", body: { items: next } });
        if (w.ok) {
          setLocalSyncedWith(syncKey);
          setSync("saved");
        } else {
          setSync("error");
          setSyncErr(w.error);
        }
      }, 600);
    },
    [syncKey, sync],
  );

  // Values for every market the list uses (and the one picked), then the series for the picked market's items.
  const marketsUsed = useMemo(() => [...new Set([m, ...items.map((i) => i.market)])].sort().join(","), [m, items]);
  useEffect(() => {
    for (const mk of marketsUsed.split(",") as MarketCode[])
      void getJson<ValuesFile>(`/values/${mk}.json`).then((v) => v && setValues((o) => (o[mk] ? o : { ...o, [mk]: v })));
  }, [marketsUsed]);
  const here = useMemo(() => items.filter((i) => i.market === m), [items, m]);
  const slugKey = [...new Set(here.map((i) => i.slug))].sort().join(",");
  useEffect(() => {
    for (const s of slugKey ? slugKey.split(",") : []) {
      const k = `${m}/${s}`;
      void getJson<SeriesFile>(`/values/${k}.json`).then((f) => setSeries((o) => (k in o ? o : { ...o, [k]: f ?? undefined })));
    }
  }, [slugKey, m]);

  const sums = totals(items, values);
  const chart = useMemo(() => {
    const byslug: Record<string, SeriesFile | undefined> = {};
    for (const it of here) byslug[it.slug] = series[`${m}/${it.slug}`];
    return portfolioSeries(here, byslug);
  }, [here, series, m]);
  const cur = MARKETS[m].currency;

  const add = (row: SearchRow, f: Omit<GearItem, "id" | "updatedAt" | "slug" | "market">) => {
    commit([...items, { id: newGearId(), slug: row.s, market: m, ...f, updatedAt: new Date().toISOString() }]);
    setPicked(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="text-sm">
          <span className="font-semibold">Market</span>{" "}
          <select value={m} onChange={(e) => setMarket(e.target.value as MarketCode)} className="ml-1 rounded border border-line bg-surface px-1 py-0.5 text-sm">
            {MARKET_CODES.map((c) => (
              <option key={c} value={c}>
                {MARKETS[c].name} ({MARKETS[c].currency})
              </option>
            ))}
          </select>
          <span className="block text-xs text-muted">New items are priced and valued in this market&apos;s currency. We never convert currencies.</span>
        </label>
        <p className="text-xs text-muted" aria-live="polite">
          {!loaded ? "" : !user ? "Kept in this browser only." : sync === "loading" ? "Loading your saved gear…" : sync === "saving" ? "Saving…" : sync === "saved" ? `Synced to your account (${user.username ?? "member"}). Only you can see it.` : sync === "error" ? `Not synced: ${syncErr}` : ""}
        </p>
      </div>

      {sums.length > 0 && (
        <section aria-labelledby="gear-total-h" className="grid gap-3 sm:grid-cols-2">
          <h2 id="gear-total-h" className="sr-only">
            Totals
          </h2>
          {sums.map((t) => (
            <div key={t.currency} className="card p-4">
              <p className="text-xs text-muted">
                Worth today ({t.markets.map((x) => MARKETS[x].short).join(", ")}, {t.currency})
              </p>
              <p className="price text-3xl font-semibold tracking-tight">{money(t.value, t.currency, true)}</p>
              <p className="mt-1 text-sm">
                {t.gain !== null ? (
                  <>
                    <Gain abs={t.gain} pct={t.pct} cur={t.currency} /> <span className="text-muted">vs the {money(t.paidOfValued, t.currency, true)} you paid</span>
                  </>
                ) : (
                  <span className="text-muted">Add what you paid to see your gain or loss.</span>
                )}
              </p>
              <p className="mt-1 text-xs text-subtle">
                {t.valued} of {t.items} item{t.items === 1 ? "" : "s"} valued
                {t.valued < t.items ? " (no prices yet for the rest, or marked faulty)" : ""}.
              </p>
            </div>
          ))}
        </section>
      )}

      {chart.length > 0 && (
        <section aria-labelledby="gear-chart-h">
          <h2 id="gear-chart-h" className="text-lg font-semibold">
            Value over time ({MARKETS[m].short}, {cur})
          </h2>
          <GearChart points={chart} currency={cur} />
          <p className="mt-1 text-xs text-subtle">Each item counts from the day you bought it, at that day&apos;s estimate. Our price history began in October 2026, so the line starts there.</p>
        </section>
      )}

      <section aria-labelledby="gear-list-h">
        <h2 id="gear-list-h" className="text-lg font-semibold">
          My gear{items.length ? ` (${items.length})` : ""}
        </h2>
        <div className="mt-2 max-w-xl">
          {picked ? (
            <ItemForm row={picked} market={m} onSave={(f) => add(picked, f)} onCancel={() => setPicked(null)} />
          ) : (
            <ProductPicker label="Add a camera or lens you own" placeholder="Search, e.g. a7 IV, X100VI, 24-70" onPick={setPicked} />
          )}
        </div>
        {ready && !items.length && <p className="mt-3 text-sm text-muted">Nothing here yet. Add the first camera or lens you own: we&apos;ll show what it&apos;s worth today and how that compares with what you paid.</p>}
        <ul className="mt-3">
          {items.map((it) => {
            const row = index.get(it.slug);
            const c = MARKETS[it.market].currency;
            const e = estimate(it, values[it.market]);
            const g = gainOf(it.paid, e.value);
            const hint = sellHint(it, e);
            return (
              <li key={it.id} className="border-b border-line py-3">
                <div className="flex gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/products/${it.slug}.webp`} alt="" width={64} height={48} loading="lazy" className="h-12 w-16 shrink-0 rounded bg-white object-contain" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{row ? <a href={productHref(row, MARKETS[it.market].prefix)} className="text-fg">{row.n}</a> : it.slug}</p>
                    <p className="text-xs text-muted">
                      {conditionLabel(it.condition)}
                      {it.bought && ` · bought ${it.bought}`}
                      {it.market !== m && ` · ${MARKETS[it.market].short} prices`}
                      {it.notes && ` · ${it.notes}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    <p className="price font-semibold">{e.value !== null ? money(e.value, c, true) : "–"}</p>
                    <p className="text-[11px] text-subtle">{e.basis === "used" ? "typical used" : e.basis === "new" ? "lowest new (no used yet)" : it.condition === "parts" ? "not valued" : "no prices yet"}</p>
                    {g && <Gain abs={g.abs} pct={g.pct} cur={c} />}
                    {it.paid !== null && <p className="text-[11px] text-subtle">paid {money(it.paid, c, true)}</p>}
                  </div>
                </div>
                {hint && <p className="mt-1 text-sm text-win">{hint}</p>}
                <div className="mt-1 flex gap-3 pl-[76px]">
                  <button type="button" className={linkButton} onClick={() => setEditing(editing === it.id ? null : it.id)}>
                    edit
                  </button>
                  <button type="button" className={linkButton} onClick={() => confirm(`Remove ${row?.n ?? it.slug} from your gear?`) && commit(items.filter((x) => x.id !== it.id))}>
                    remove
                  </button>
                </div>
                {editing === it.id && (
                  <ItemForm
                    row={null}
                    market={it.market}
                    initial={it}
                    onSave={(f) => {
                      commit(items.map((x) => (x.id === it.id ? { ...x, ...f, updatedAt: new Date().toISOString() } : x)));
                      setEditing(null);
                    }}
                    onCancel={() => setEditing(null)}
                  />
                )}
              </li>
            );
          })}
        </ul>
        {items.length > 0 && <p className="mt-2 text-xs text-subtle">Values are estimates from asking prices at the stores we track (typical used over 90 days once we have a week of used prices; until then the lowest new price). They aren&apos;t offers, and condition, box and accessories change what yours would fetch.</p>}
      </section>

      {loaded && !user && (
        <section className="border-t border-line pt-4">
          <SignInBox prompt="Sign in to keep your gear on every device (it stays private)." next="/collection" />
        </section>
      )}
    </div>
  );
}
