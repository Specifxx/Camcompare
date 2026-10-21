# Premium: a plan, not built

Status: **not built.** The owner approved community v1 (accounts, comments,
votes, CamKarma, reviews, boards) and asked for a premium plan to decide on
later. Nothing here exists in the code. Accounts from community v1 are what
premium would hang off.

## The hook: instant alerts (owner's friends, 2026-10-21)

The friends' pitch is "almost a news marketplace": makers "randomly release
things… everyone kind of knows, but nobody's out here waiting and checking."
A Godox flash nobody in Australia stocked yet (bought from a scam reseller),
a Sony FX5 preorder gone in about ten minutes, iPhone preorders that start
without warning, an X100VI five months backordered. What people would pay
for is **hearing first**: "as soon as our website scrapes this data it will
message/email you the offer." So alerts are the monetisation hook, and the
line between free and paid is speed and channel, never the information.

What exists now (free, built 2026-10-21):

- `/releases` ("Just announced"): makers' launch videos and press releases
  (`scripts/fetch-releases.ts`, 44 makers), each with the stores in the
  visitor's market that take orders, and comments.
- Alerts by email, five kinds: any price drop, only deals under a price, back
  in stock, preorder opens (for a product, or for a release card before we
  even list the product), and a maker's announcements
  (`lib/alert-kinds.ts`, `scripts/check-alerts.ts`).
- Checked after every price import, **about every three hours**. Stores only,
  never marketplace resellers.

### Free and premium

| | Free | Premium |
| --- | --- | --- |
| Alert kinds | All five | All five |
| How fast | After each import, about every 3 h | Watched products re-checked about every 30 min (or 10–15 min), see "Instant-ish checks" |
| Channels | Email | Email, SMS, WhatsApp, web push |
| Preorder-drop alerts | When the next import sees a store listing it | Brand watch on a fast cycle: a maker's video or press release goes out within the hour, with any preorder link we find |
| Alerts per address | `ALERTS_PER_EMAIL` (50) | 100+ |
| Emails per run | `EMAILS_PER_ADDRESS_RUN` (3) per address | Higher per-address cap |

Never sell: a different order of offers, a "premium-only" price, or a hidden
store. Free users see every store and price on the page; premium only hears
sooner and on more channels.

### What each premium piece would cost to run

| Piece | Infrastructure | Running cost (check current prices) |
| --- | --- | --- |
| Faster checks | The watch workflow below, already built behind `WATCH_CHECKS`. Every 30 min, then 10–15 min for premium-watched products. | GitHub Actions: free on this public repo (about 2 min a run, ~100 min a day at 30 min). A private repo would pay for minutes past the free 2,000 a month. Neon: one SELECT a run (one compute wake each, inside the free plan's compute at this rate). Stores: at most 60 pages a run, 12 per store. No commits, no Vercel builds. |
| SMS | Twilio (or MessageBird) account, a sender number per country, `sms_number` column with its own opt-in code, STOP handling. | Roughly US$0.01 a text in the US, US$0.04–0.10 in the UK, EU, AU and SG, plus a number at ~US$1–15 a month per country. Australia, the UK and Singapore need a registered sender ID. This is the expensive channel, so premium only. |
| WhatsApp | WhatsApp Business Platform through Twilio or Meta directly: a verified Meta business, an approved message template per alert kind, opt-in recorded. | Per-message "utility" template fees, about US$0.004–0.05 depending on country, plus the provider's markup. Weeks of setup for verification and templates. |
| Web push | A service worker, VAPID keys (`web-push`), a `push_subscriptions` table, sending from the same Actions job. | Free to send. iPhone needs the site added to the home screen first, so email stays the default. |
| Preorder-drop alerts | `fetch-releases.ts` in the fast workflow too (hourly), emailing brand and release-preorder alerts without committing; the 3-hourly import still publishes the page. | YouTube Data API: 1 unit per channel per run; 51 channels hourly is ~1,250 of the free 10,000 units a day (every 3 h: ~410). |
| Payments | Stripe (below). Not built. | Stripe's card fees. |

### Instant-ish checks (design; MVP built, off)

The rule that can't bend: same sources, same robots.txt, same "a 403, 429 or
challenge stops that store", and no extra deploys. So "faster" means re-reading
**only what someone is waiting for**, from stores that already allow it:

1. `.github/workflows/watch-alerts.yml` (owner to add, below) runs `scripts/check-watched.ts` every 30 min
   while the repo variable `WATCH_CHECKS` is `1`.
2. One SELECT: the confirmed restock and preorder alerts. None means stop
   there, so an idle site costs one query.
3. For their products only, each **stored** store offer is re-read: Shopify
   stores through `/products/<handle>.js` (one product's variants), structured
   data stores through the offer's own page. robots.txt is checked per store,
   at most 60 pages a run and 12 per store, 1.5 s apart. Feed stores wait for
   the next import (a feed is a whole file), and eBay and Amazon are never
   re-read (marketplaces, and Amazon's price may not be stored).
4. The fresher stock goes through the same `runAlerts` as the 3-hourly check
   (same transitions, gaps, per-address caps), then is thrown away: **no file
   written, nothing committed, nothing deployed.**

What it can't do: notice a store that has never listed the product before
(that needs the full import). A preorder opening at a new store is caught at
the next import; a restock at a store that already lists it is caught within
30 minutes.

#### The workflow (owner to add)

```yaml
# .github/workflows/watch-alerts.yml: restock and preorder alerts between
# imports (scripts/check-watched.ts). Writes and commits nothing, so it never
# deploys. Runs only while the repository variable WATCH_CHECKS is 1.
name: watch-alerts
on:
  schedule:
    - cron: "*/30 * * * *"
  workflow_dispatch:
concurrency: watch-alerts
permissions:
  contents: read
jobs:
  watch:
    if: vars.WATCH_CHECKS == '1'
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
        with:
          ref: main
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - name: Check watched products
        env:
          WATCH_CHECKS: "1"
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          ALERTS_FROM_EMAIL: ${{ secrets.ALERTS_FROM_EMAIL }}
        run: npx tsx scripts/check-watched.ts
```

GitHub may start a scheduled run 5 to 30 minutes late when it is busy, so
"about every 30 minutes" is the honest promise.

## What premium could include

| Feature | What it does | Builds on |
| --- | --- | --- |
| Instant alerts | Watched products re-checked about every 30 min between imports (restock, preorder), SMS/WhatsApp/push as well as email, and preorder-drop alerts on a fast brand watch. See "The hook" above. | `scripts/check-watched.ts` (built, off) and `scripts/check-alerts.ts` (every import, every three hours). Say plainly how fast: "within about 30 minutes", never "real time". |
| More watchlist slots | Free accounts keep today's limit (`ALERTS_PER_EMAIL`); premium gets, say, 100 alerts and a synced saved list across devices. | `price_alerts`, `lib/saved.ts` (today saved lists live only in the browser). |
| Deal-gone alerts | "The used A7 IV you were watching sold / went back up." An email when the offer you were told about disappears or rises past a threshold. | The same per-import check, comparing with `last_notified_price`. |
| Price-history CSV export | Download a product's daily lowest new and used price per market. | `data/price-history/`, already public JSON. The export is a convenience, not exclusive data (the history is published with the source). |
| No ads | `AdSlot` renders nothing for a signed-in premium member. | `AdSlot` already renders nothing without an AdSense id. Ads aren't on yet, so this only has value once they are. |
| CamExpert flair | A cosmetic flair next to the username (colour or a custom short label), separate from the earned [CamExpert] badge. | `community_users`. The earned badge must stay earned: flair never says "CamExpert". |
| Superlikes | See below. | `community_votes`. |

### Superlikes

A premium member gets a few superlikes a month to give a comment, review or
thread they found really useful. What one would do:

- show a small "superliked" marker and count on the post;
- notify the author ("someone found your review of the X-T5 really useful");
- appear on the author's profile as a count.

What one must **not** do: add extra score, move a post up in "top", add
CamKarma, or affect anything about deals or offers.

**Why cosmetic only.** CamCompare's trust rests on "commission never decides
order": offers are always sorted by price. If paying members could push posts
up, the community's ranking would be for sale, and a reader couldn't tell a
genuinely useful review from a paid-for one. That is exactly the doubt the
site exists to remove, and it would spill over onto the price tables next to
it. Deal votes are already kept out of ordering; superlikes should be kept out
of every ordering too. Superlikes on deals: don't offer them at all (a paid
signal next to an affiliate link reads as advertising).

## Suggested prices

Friends said more than $5/month is fine. A camera buyer saves far more than
that on one good used deal, so price on value, with a cheap way in:

| Tier | Monthly | Yearly | Includes |
| --- | --- | --- | --- |
| Free | $0 | $0 | Accounts, comments, reviews, votes, all five alert kinds by email after each import (about every 3 h) |
| **Plus** | $6 | $54 (25% off) | Instant alerts (30-minute checks, push and SMS/WhatsApp), preorder-drop alerts, 100 watchlist slots, deal-gone alerts, CSV export, no ads |
| **Pro** | $12 | $108 | Plus, unlimited alerts with per-retailer filters, flair, 5 superlikes a month |

- Charge in each market's own currency (US$, £, €, A$, S$) at round local
  prices, not a converted figure: the site never converts currencies for
  display.
- Offer a 14-day free trial on Plus, and a "gear-hunt pass": one month of Plus
  for $8, no renewal, for people buying one camera.
- Revisit after three months of numbers: if almost nobody picks Pro, fold its
  extras into Plus at $7.

## What the owner must set up first

1. **Stripe account** (business details, bank account for payouts, identity
   verification). Use Stripe Checkout and the Customer Portal so the site
   never touches card numbers.
2. **Products and prices** in Stripe: Plus and Pro, monthly and yearly, one
   price per currency. Turn on the free trial for Plus.
3. **Tax.** Turn on Stripe Tax and register where needed: UK VAT, EU VAT
   (OSS for digital services), Australian GST, Singapore GST once over the
   threshold, US states with economic nexus for digital goods. Prices shown
   to EU, UK and AU buyers must include tax.
4. **Refunds and cancellation policy**: say plainly that cancelling stops
   renewal, what happens to alerts over the free limit (paused, not deleted),
   and the refund window (EU and UK buyers have a 14-day withdrawal right for
   digital services unless they agree to start immediately).
5. **Terms of service and an updated privacy page**: billing data is held by
   Stripe; the site stores only the Stripe customer id and plan.
6. **Vercel variables** (when it is built): `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and the
   price ids. A webhook endpoint writes the member's plan into the same Neon
   project; pages stay static and read the plan client-side, like the
   community does.
7. **Ops**: a check that the webhook has delivered recently, and an owner
   email on failed payments, capped per day like the community's notices.

## Order to build it in

1. Plus with instant alerts (turn on `WATCH_CHECKS` for paying members' alerts first), web push, then SMS; more slots.
2. Deal-gone alerts and CSV export.
3. No ads (only once ads are live).
4. Pro, flair and cosmetic superlikes, only if Plus sells.
