// Runs after the price import and the release fetch (refresh-prices.yml):
// emails each confirmed alert that has news (lib/alert-run.ts):
//  - price:    cheap enough now (decideNotify);
//  - restock / preorder: a store's stock moved into "in stock" / "can be
//    ordered" since the state stored on the alert (decideStock). The stored
//    state is the previous import's view, so a transition is caught even when
//    an import was skipped, and the watch check's runs count too;
//  - brand:    data/releases.json has an announcement from that maker newer
//    than the alert's cursor (decideBrand).
// Prices and stock come from the committed data/offers/<market>.json, so never
// Amazon's (which may not be stored or emailed as a stored price).
// Without DATABASE_URL or RESEND_API_KEY it says so and exits 0: alerts
// simply aren't switched on yet. One SELECT per run, one UPDATE per change.
import { runAlerts } from "../src/lib/alert-run";
import { activeAlerts, alertsConfigured } from "../src/lib/alerts";
import { logSafe } from "../src/lib/feedback";
import { MARKET_CODES, type MarketCode } from "../src/lib/markets";
import { readOffersFile, type Offer } from "../src/lib/offers";
import { readReleases } from "../src/lib/releases/data";

/** A run sends at most this many emails (Resend's free tier: 100 a day). */
const MAX_EMAILS = Number(process.env.ALERTS_MAX_EMAILS) || 90;

async function main() {
  if (!alertsConfigured()) {
    console.log("check-alerts: DATABASE_URL or RESEND_API_KEY not set, skipping");
    return;
  }
  const byMarket = new Map<MarketCode, Map<string, Offer[]>>();
  for (const m of MARKET_CODES) {
    const map = new Map<string, Offer[]>();
    for (const o of readOffersFile(m).offers) (map.get(o.product) ?? map.set(o.product, []).get(o.product)!).push(o);
    byMarket.set(m, map);
  }

  const alerts = await activeAlerts();
  const r = await runAlerts({
    alerts,
    offersOf: (m, slug) => byMarket.get(m)?.get(slug) ?? [],
    releases: readReleases().releases,
    maxEmails: MAX_EMAILS,
    log: (s) => console.error(`check-alerts: ${s}`),
  });
  const counts = Object.entries(r.counts).map(([k, n]) => `${k} ${n}`).join(", ");
  console.log(`check-alerts: ${r.alerts} alerts, ${r.sent} emails sent, ${r.failed} failed${counts ? ` (${counts})` : ""}`);
  if (r.held) console.log(`check-alerts: ${r.held} held back by the per-run caps (${MAX_EMAILS} a run, a few per address); they go next run`);
  if (r.failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(`check-alerts: ${logSafe(e)}`);
  process.exit(1);
});
