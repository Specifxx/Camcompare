// One pass over the alerts: decide, email, remember. Shared by
// scripts/check-alerts.ts (every alert, after each price import) and
// scripts/check-watched.ts (restock and preorder alerts only, between imports,
// against freshly re-read stock). Server-only.
//
// Bounds, so a busy run can't flood anyone (or Resend's free 100 a day):
//  - at most `maxEmails` a run, the time-critical kinds first (preorder,
//    restock, then brand, then price); the rest go next run, untouched;
//  - at most EMAILS_PER_ADDRESS_RUN to one address a run;
//  - each alert has its own gap (NOTIFY_GAP_MS, STOCK_NOTIFY_GAP_MS,
//    BRAND_NOTIFY_GAP_MS) and fires on news only: a lower price than it last
//    reported, a transition into stock, an announcement newer than its cursor.
import { EMAILS_PER_ADDRESS_RUN, type AlertType } from "./alert-kinds";
import { alertOrderState, brandEmail, decideBrand, decideNotify, decideStock, lowestFor, markNotified, priceEmail, sendEmail, setBaseline, setState, stockEmail, storeLines, type AlertRow, type Email } from "./alerts";
import { displayName, product } from "./catalog";
import { logSafe } from "./feedback";
import type { MarketCode } from "./markets";
import type { Offer } from "./offers";
import { releaseBrandName } from "./releases/brands";
import type { Release } from "./releases/core";
import { storeRows } from "./releases/stock";
import { retailer } from "./retailers";

export type RunInput = {
  alerts: AlertRow[];
  offersOf: (m: MarketCode, slug: string) => Offer[];
  releases: Release[];
  maxEmails: number;
  now?: number;
  /** Tests pass fakes; the scripts pass lib/alerts.ts's. */
  io?: Partial<RunIO>;
  log?: (s: string) => void;
};

export type RunIO = {
  send: (e: Email) => Promise<void>;
  markNotified: typeof markNotified;
  setBaseline: typeof setBaseline;
  setState: typeof setState;
};

export type RunSummary = { alerts: number; sent: number; failed: number; held: number; counts: Record<string, number> };

const ORDER: Record<AlertType, number> = { preorder: 0, restock: 1, brand: 2, price: 3 };
const storeName = (k: string) => retailer(k)?.name ?? k;

export async function runAlerts({ alerts, offersOf, releases, maxEmails, now = Date.now(), io: given, log = console.log }: RunInput): Promise<RunSummary> {
  const io: RunIO = { send: sendEmail, markNotified, setBaseline, setState, ...given };
  const byId = new Map(releases.map((r) => [r.id, r]));
  const announcedBy = new Map<string, Release[]>();
  for (const r of releases) if (r.isAnnouncement) (announcedBy.get(r.brand) ?? announcedBy.set(r.brand, []).get(r.brand)!).push(r);
  const releaseProducts = (id: string) => (byId.get(id)?.products ?? []).filter((s) => product(s));

  const perAddress = new Map<string, number>();
  const counts: Record<string, number> = {};
  const bump = (k: string) => (counts[k] = (counts[k] ?? 0) + 1);
  let sent = 0;
  let failed = 0;
  let held = 0;
  const canSend = (email: string) => sent < maxEmails && (perAddress.get(email) ?? 0) < EMAILS_PER_ADDRESS_RUN;
  const sendOne = async (a: AlertRow, e: Email) => {
    await io.send(e);
    sent++;
    perAddress.set(a.email, (perAddress.get(a.email) ?? 0) + 1);
  };

  for (const a of [...alerts].sort((x, y) => ORDER[x.type] - ORDER[y.type] || Number(x.id) - Number(y.id))) {
    try {
      if (a.type === "brand") {
        const d = decideBrand(a, announcedBy.get(a.product) ?? [], now);
        bump(`brand:${d.action}`);
        if (d.action === "baseline") await io.setState(a.id, d.cursor);
        else if (d.action === "notify") {
          if (!canSend(a.email)) {
            held++;
            continue;
          }
          await sendOne(a, brandEmail(a, releaseBrandName(a.product), d.releases));
          await io.setState(a.id, d.cursor, true, new Date(now));
        }
        continue;
      }

      if (a.type === "restock" || a.type === "preorder") {
        if (a.kind === "release" ? !byId.has(a.product) : !product(a.product)) continue; // gone from this build: keep the alert, nothing to check
        const offersFor = (s: string) => offersOf(a.market, s);
        const state = alertOrderState(a, offersFor, releaseProducts);
        const d = decideStock(a, state, now);
        bump(`${a.type}:${d.action}`);
        if (d.action === "baseline" || d.action === "state") await io.setState(a.id, d.state);
        else if (d.action === "notify") {
          if (!canSend(a.email)) {
            held++;
            continue;
          }
          const slugs = a.kind === "release" ? releaseProducts(a.product) : [a.product];
          const rows = storeRows(slugs.flatMap(offersFor)).filter((r) => (a.type === "restock" ? r.state === "in_stock" : r.state === "in_stock" || r.state === "preorder"));
          const name = a.kind === "release" ? (byId.get(a.product)?.title ?? "the new release") : displayName(product(a.product)!.item, a.market);
          await sendOne(a, stockEmail(a, name, d.state, storeLines(rows, a.market, storeName)));
          await io.setState(a.id, d.state, true, new Date(now));
        }
        continue;
      }

      // price
      const p = product(a.product);
      if (!p) continue; // unpublished product: keep the alert, nothing to price
      const offer = lowestFor(offersOf(a.market, a.product), a.condition);
      const d = decideNotify(a, offer?.price ?? null, now);
      bump(`price:${d.action}`);
      if (d.action === "baseline") await io.setBaseline(a.id, d.price);
      else if (d.action === "rearm") await io.setBaseline(a.id, null);
      else if (d.action === "notify" && offer) {
        if (!canSend(a.email)) {
          held++;
          continue;
        }
        await sendOne(a, priceEmail(a, displayName(p.item, a.market), offer, storeName(offer.retailer)));
        await io.markNotified(a.id, offer.price, new Date(now));
      }
    } catch (e) {
      failed++;
      log(`alert ${a.id} (${a.type} ${a.product}, ${a.market}) failed: ${logSafe(e)}`);
    }
  }
  return { alerts: alerts.length, sent, failed, held, counts };
}
