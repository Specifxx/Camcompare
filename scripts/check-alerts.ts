// Runs after the price import (refresh-prices.yml): emails each confirmed
// price alert whose product is now cheap enough (decideNotify in lib/alerts.ts).
// Prices come from the committed data/offers/<market>.json through lowest(),
// so never Amazon's (which may not be stored or emailed as a stored price).
// Without DATABASE_URL or RESEND_API_KEY it says so and exits 0: alerts
// simply aren't switched on yet. One SELECT per run, one UPDATE per change.
import { activeAlerts, alertsConfigured, decideNotify, lowestFor, markNotified, priceEmail, sendEmail, setBaseline } from "../src/lib/alerts";
import { displayName, product } from "../src/lib/catalog";
import { logSafe } from "../src/lib/feedback";
import { MARKET_CODES, type MarketCode } from "../src/lib/markets";
import { readOffersFile, type Offer } from "../src/lib/offers";
import { retailer } from "../src/lib/retailers";

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
  let sent = 0;
  let failed = 0;
  const counts = { notify: 0, baseline: 0, rearm: 0, none: 0 };
  for (const a of alerts) {
    const p = product(a.product);
    if (!p) continue; // unpublished product: keep the alert, nothing to price
    const offer = lowestFor(byMarket.get(a.market)?.get(a.product) ?? [], a.condition);
    const d = decideNotify(a, offer?.price ?? null);
    counts[d.action]++;
    try {
      if (d.action === "baseline") await setBaseline(a.id, d.price);
      else if (d.action === "rearm") await setBaseline(a.id, null);
      else if (d.action === "notify" && offer) {
        if (sent >= MAX_EMAILS) continue;
        await sendEmail(priceEmail(a, displayName(p.item, a.market), offer, retailer(offer.retailer)?.name ?? offer.retailer));
        await markNotified(a.id, offer.price);
        sent++;
      }
    } catch (e) {
      failed++;
      console.error(`check-alerts: alert ${a.id} (${a.product}, ${a.market}) failed: ${logSafe(e)}`);
    }
  }
  console.log(`check-alerts: ${alerts.length} alerts, ${sent} emails sent, ${counts.baseline} baselines, ${counts.rearm} re-armed, ${failed} failed`);
  if (counts.notify > sent + failed) console.log(`check-alerts: ${counts.notify - sent - failed} held back by the per-run cap (${MAX_EMAILS}); they go next run`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(`check-alerts: ${logSafe(e)}`);
  process.exit(1);
});
