# Premium: a plan, not built

Status: **not built.** The owner approved community v1 (accounts, comments,
votes, CamKarma, reviews, boards) and asked for a premium plan to decide on
later. Nothing here exists in the code. Accounts from community v1 are what
premium would hang off.

## What premium could include

| Feature | What it does | Builds on |
| --- | --- | --- |
| Instant deal alerts | An email (later push) within minutes of a price import that finds a drop, instead of at most one a day per alert. | `scripts/check-alerts.ts`, which already runs after every import (every three hours). "Instant" means "the next import", not real time: say so. |
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
| Free | $0 | $0 | Accounts, comments, reviews, votes, today's alert limit, daily alert emails |
| **Plus** | $6 | $54 (25% off) | Instant deal alerts, 100 watchlist slots, deal-gone alerts, CSV export, no ads |
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

1. Plus with instant alerts and more slots (the features people asked for).
2. Deal-gone alerts and CSV export.
3. No ads (only once ads are live).
4. Pro, flair and cosmetic superlikes, only if Plus sells.
