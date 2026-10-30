"use client";
// The quick view (lib/quickview.ts). Every ProductCard renders a
// QuickViewHost; the first one mounted leads: it listens (capture phase, so
// next/link sees the click as handled) for plain left clicks on a[data-qv]
// and opens the dialog. Modified clicks, middle clicks and new tabs follow
// the link. The open product is in the URL (?view=<slug>, a pushed history
// entry), so Back closes it and a shared link opens it.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { price } from "@/lib/format";
import { marketFromPath } from "@/lib/market-client";
import { isMarket, MARKETS, type MarketCode } from "@/lib/markets";
import { quickViewFile, viewParam, withView, type QuickViewData } from "@/lib/quickview";
import { AlsoCheck, EbayListings, OfferRowItem, PinnedMarkets, ebayPin, type PinnedLink } from "./OfferRows";
import { retailer } from "@/lib/retailers";
import EbayText from "./ebay/EbayText";
import ProductThumb from "./ProductThumb";
import SpecHighlights from "./SpecHighlights";
import OutboundLink from "./OutboundLink";
import PriceAlert from "./PriceAlert";

/** Amazon (its tagged link: a public file never holds its price) and eBay, pinned above the rows. */
const qvPins = (d: QuickViewData): PinnedLink[] => {
  const amazon = d.alsoCheck.find((l) => retailer(l.retailer)?.amazon);
  const ebay = d.ebay ? ebayPin(d.ebay.name, d.ebay.listings[0], d.ebay.all ?? d.ebay.search ?? null) : null;
  return [amazon && { ...amazon, note: "New, sold by Amazon and its sellers: the price shows on Amazon", cta: "Check price" }, ebay].filter(Boolean) as PinnedLink[];
};

/** The cheapest in-stock, body-only row, new or not: the price the alert check reads (Amazon and eBay are not in rows). */
const lowRow = (rows: QuickViewData["rows"], isNew: boolean) => rows.filter((r) => r.inStock && !r.kit && !r.amazon && (r.condition === "New") === isNew).reduce<number | null>((b, r) => (b === null || r.price < b ? r.price : b), null);

type Target = { slug: string; market: MarketCode; name?: string; href?: string };

// ---- one store for every host: what is open, and who leads
let current: Target | null = null;
let trigger: HTMLElement | null = null;
const hosts: object[] = [];
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};
const setCurrent = (t: Target | null) => {
  current = t;
  emit();
};

const cache = new Map<string, Promise<QuickViewData>>();
function load(m: MarketCode, slug: string): Promise<QuickViewData> {
  const url = quickViewFile(m, slug);
  let p = cache.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<QuickViewData>;
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

const pushedFor = (slug: string) => (window.history.state as { qv?: string } | null)?.qv === slug;

export function openQuickView(t: Target, from?: HTMLElement | null) {
  trigger = from ?? null;
  const { pathname, search, hash } = window.location;
  window.history.pushState({ qv: t.slug }, "", withView(pathname, search, hash, t.slug));
  setCurrent(t);
}

export function closeQuickView() {
  const t = current;
  if (!t) return;
  setCurrent(null);
  if (pushedFor(t.slug)) window.history.back();
  else {
    const { pathname, search, hash } = window.location;
    window.history.replaceState(null, "", withView(pathname, search, hash, null));
  }
}

function anchorOf(e: Event): HTMLAnchorElement | null {
  const el = e.target as Element | null;
  return (el?.closest?.("a[data-qv]") as HTMLAnchorElement | null) ?? null;
}

function Controller() {
  const open = useSyncExternalStore(subscribe, () => current, () => null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = anchorOf(e);
      const m = a?.dataset.qvMarket;
      if (!a || !a.dataset.qv || !m || !isMarket(m) || (a.target && a.target !== "_self")) return;
      e.preventDefault();
      openQuickView({ slug: a.dataset.qv, market: m, name: a.dataset.qvName, href: a.getAttribute("href") ?? undefined }, a);
    };
    const warm = (e: Event) => {
      const a = anchorOf(e);
      const m = a?.dataset.qvMarket;
      if (a?.dataset.qv && m && isMarket(m)) load(m, a.dataset.qv).catch(() => {});
    };
    const onPop = () => {
      const v = viewParam(window.location.search);
      if (!v && current) setCurrent(null);
      else if (v && current?.slug !== v) setCurrent({ slug: v, market: marketFromPath(window.location.pathname) });
    };
    window.addEventListener("click", onClick, true);
    window.addEventListener("pointerdown", warm, true);
    window.addEventListener("focusin", warm, true);
    window.addEventListener("popstate", onPop);
    const v = viewParam(window.location.search);
    if (v && !current) setCurrent({ slug: v, market: marketFromPath(window.location.pathname) });
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("pointerdown", warm, true);
      window.removeEventListener("focusin", warm, true);
      window.removeEventListener("popstate", onPop);
    };
  }, []);
  return open ? createPortal(<Dialog key={`${open.market}/${open.slug}`} target={open} />, document.body) : null;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';

function Dialog({ target }: { target: Target }) {
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const downOnBackdrop = useRef(false);
  const [data, setData] = useState<QuickViewData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    load(target.market, target.slug)
      .then((d) => live && setData(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [target.market, target.slug]);

  // Scroll lock, first focus, focus back to the card on close.
  useEffect(() => {
    const html = document.documentElement;
    const gap = window.innerWidth - html.clientWidth;
    const prev = [html.style.overflow, document.body.style.paddingRight];
    html.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    closeBtn.current?.focus({ preventScroll: true });
    const keepIn = (e: FocusEvent) => {
      if (panel.current && e.target instanceof Node && !panel.current.contains(e.target)) closeBtn.current?.focus({ preventScroll: true });
    };
    document.addEventListener("focusin", keepIn);
    return () => {
      html.style.overflow = prev[0];
      document.body.style.paddingRight = prev[1];
      document.removeEventListener("focusin", keepIn);
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      closeQuickView();
      return;
    }
    if (e.key !== "Tab" || !panel.current) return;
    const els = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!els.length) return;
    const [first, last] = [els[0], els[els.length - 1]];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const m = target.market;
  const href = data?.href ?? target.href;
  const name = data?.name ?? target.name ?? "";
  // The same headline as the product page (lib/price-rules.ts): body-only new, else used, else a kit, labelled.
  const from = data?.from ?? null;
  const stores = new Set(data?.rows.map((r) => r.retailer)).size + (data?.ebay?.listings.length ? 1 : 0);
  const goFull = (e: React.MouseEvent) => {
    if (!href || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const pushed = pushedFor(target.slug);
    setCurrent(null);
    if (pushed) router.replace(href);
    else router.push(href);
  };

  return (
    <div
      className="qv-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onPointerDown={(e) => (downOnBackdrop.current = e.target === e.currentTarget)}
      onClick={(e) => {
        if (e.target === e.currentTarget && downOnBackdrop.current) closeQuickView();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="qv-title"
        onKeyDown={onKey}
        className="qv-panel relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-2xl sm:max-h-[88vh] sm:max-w-2xl sm:rounded-2xl"
      >
        <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" />
        <button ref={closeBtn} type="button" onClick={closeQuickView} aria-label="Close" className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-muted hover:bg-raised hover:text-fg">
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        <div className="flex flex-col gap-5 overflow-y-auto overscroll-contain px-4 pb-5 pt-3 sm:px-6 sm:pt-6">
          <header className="flex items-start gap-3 pr-10 sm:gap-4">
            <ProductThumb slug={target.slug} alt="" className="w-28 shrink-0 border border-line sm:w-40" />
            <div className="min-w-0">
              {data && <p className="text-xs font-medium text-subtle">{data.brandName}</p>}
              <h2 id="qv-title" className="text-lg font-extrabold leading-tight tracking-tight sm:text-xl">
                {name || <span className="inline-block h-5 w-40 animate-pulse rounded bg-raised" />}
              </h2>
              {data && <p className="mt-1 text-xs text-muted">{data.subline}</p>}
              {data && (
                <p className="mt-2 text-sm">
                  {from ? (
                    <>
                      <span className="text-xs text-subtle">{from.what === "new" ? "New from " : from.what === "used" ? "Used from " : "Kit from "}</span>
                      <span className={`price text-lg font-bold ${from.what === "new" ? "text-buy" : ""}`}>{price(from.price, data.currency)}</span>
                      <span className="text-xs text-subtle"> · {stores} store{stores === 1 ? "" : "s"}</span>
                      {from.label && <span className="block text-xs text-subtle">{from.label}; no body-only price today</span>}
                    </>
                  ) : (
                    <span className="text-xs text-subtle">No live price in {MARKETS[m].name} yet</span>
                  )}
                </p>
              )}
              {data && (data.rrp || data.usedTypical || data.lowestUsed) ? (
                <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
                  {data.rrp ? (
                    <span>
                      Launch RRP <span className="price font-semibold text-fg">{price(data.rrp, data.currency)}</span>
                    </span>
                  ) : null}
                  {data.usedTypical ? (
                    <span>
                      Used, typically <span className="price font-semibold text-fg">{price(data.usedTypical, data.currency)}</span>
                    </span>
                  ) : data.lowestUsed ? (
                    <span>
                      Used from <span className="price font-semibold text-fg">{price(data.lowestUsed, data.currency)}</span>
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
          </header>

          {failed ? (
            <p className="card p-4 text-sm text-muted">
              Couldn&apos;t load the prices. {href ? <Link href={href} onClick={goFull}>Open the product page</Link> : null}
            </p>
          ) : !data ? (
            <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading prices">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-raised" />
                ))}
              </div>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-raised" />
              ))}
            </div>
          ) : (
            <>
              <SpecHighlights items={data.highlights} compact />
              <section aria-labelledby="qv-prices">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h3 id="qv-prices" className="font-bold">
                    Prices in {MARKETS[m].name}
                  </h3>
                  {data.updated && <span className="text-[11px] text-subtle">Checked {new Date(data.updated).toUTCString().slice(5, 16)}</span>}
                </div>
                <PinnedMarkets links={qvPins(data)} product={data.slug} placement="qv-pinned" dense className="mb-2" />
                {data.rows.length ? (
                  <ul className="card divide-y divide-line">
                    {data.rows.map((r) => (
                      <OfferRowItem key={r.id} row={r} product={data.slug} placement="quickview" dense rrp={data.rrp} usedTypical={data.usedTypical} />
                    ))}
                  </ul>
                ) : (
                  <div className="card p-4">
                    <p className="text-sm font-semibold">No live prices here yet</p>
                    <p className="mt-1 text-xs text-muted">We list a price only when a retailer&apos;s feed or API sends one, checked every day.</p>
                  </div>
                )}
                {data.mounts > 1 && <p className="mt-2 text-[11px] text-subtle">Made in {data.mounts} mount versions: check the version before you buy.</p>}
              </section>
              <div className="flex flex-wrap gap-2">
                <PriceAlert slug={data.slug} kind={data.kind} market={m} newPrice={lowRow(data.rows, true)} usedPrice={lowRow(data.rows, false)} />
              </div>
              {data.ebay && (
                <section aria-label={`On ${data.ebay.name}`} className="flex flex-col gap-2">
                  <h3 className="font-bold">On {data.ebay.name}</h3>
                  {data.ebay.listings.length > 0 && <EbayListings listings={data.ebay.listings} product={data.slug} placement="quickview-ebay" />}
                  {(data.ebay.used || data.ebay.sold) && (
                    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {data.ebay.used && <EbayText link={data.ebay.used} product={data.slug} placement="qv-ebay-used">{data.ebay.used.label}</EbayText>}
                      {data.ebay.sold && <EbayText link={data.ebay.sold} product={data.slug} placement="qv-ebay-sold">{data.ebay.sold.label}</EbayText>}
                    </p>
                  )}
                  {data.ebay.all && (
                    <div className="text-right">
                      <OutboundLink href={data.ebay.all.href} retailer={data.ebay.all.retailer} product={data.slug} placement="qv-ebay-all" className={data.ebay.all.paid ? "btn-ebay" : "btn-ghost"}>
                        {data.ebay.all.cta}
                      </OutboundLink>
                      {data.ebay.all.paid && <p className="mt-0.5 text-[10px] text-subtle">Paid link</p>}
                    </div>
                  )}
                </section>
              )}
              <AlsoCheck links={data.alsoCheck.filter((l) => !retailer(l.retailer)?.amazon)} product={data.slug} placement="quickview-check" />
              <p className="text-[11px] text-subtle">Amazon and eBay are ads. The stores are sorted by price, cheapest in-stock first; commission never changes the store order.</p>
            </>
          )}
        </div>
        {href && (
          <div className="shrink-0 border-t border-line bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
            <Link href={href} prefetch={false} onClick={goFull} className="btn-primary w-full sm:w-auto">
              Full specs &amp; price history →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/** Rendered by every card; only the first mounted renders the controller. */
export default function QuickViewHost() {
  const [me] = useState(() => ({}));
  useEffect(() => {
    hosts.push(me);
    emit();
    return () => {
      hosts.splice(hosts.indexOf(me), 1);
      emit();
    };
  }, [me]);
  const leader = useSyncExternalStore(subscribe, () => hosts[0] === me, () => false);
  return leader ? <Controller /> : null;
}
