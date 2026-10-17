# CamCompare: feasibility (2026-10-17)

**Verdict: feasible, and worth building, but it is a different business from
RiftCompare.** Each visitor is worth far more. Getting visitors is far harder.
The way in is used and new price history across retailers, not spec
comparison on its own.

## 1. Money: each visitor is worth far more

| | RiftCompare (cards) | CamCompare (cameras) |
|---|---|---|
| Typical basket | a $5–50 single | a $600–4,000 body; mirrorless averages ~$711 *wholesale* (CIPA, via DPReview) |
| Commission | eBay; most Shopify card stores have no programme | Amazon ~2–4% (its rate card no longer lists cameras separately), B&H ~2% base and up to 8% on featured brands, Adorama ~2% base on Impact, MPB 2.4% plus $8 per sell-referral, eBay ~2% on cameras (third-party figure) |
| Per sale | cents to ~$1 | **~$20–60** |

A rough model, to size it rather than forecast it: 1,000 buying-intent visits
a day × 30% clicking out × 1–2% buying × a $1,200 basket × 2.5% ≈
**$2,700–5,400 a month**. RiftCompare, for scale, reported 16 Premium
subscribers ($46.59 MRR) and 130–200 Google clicks a day in
`docs/GROWTH-PLAYBOOK-2026-10.md`. One camera sale earns about what a month of
RiftCompare Premium does.

## 2. Traffic: much harder

- **The camera community is online, but it is mature.** Buyers research on
  YouTube reviews, Reddit and forums, plus sites with 15–20-year-old domains:
  DPReview (revived), PetaPixel, Digital Camera World, Camera Decision,
  Versus, Apotelyt, and Google Shopping for prices. RiftCompare grew by being
  early in a brand-new game. Cameras have no such window.
- **"X vs Y" spec pages are the most crowded results in the niche.** A new
  domain mass-producing them also risks Google's scaled-content-abuse policy.
  So this build indexes only the curated rival pairs (the cameras buyers
  really cross-shop), and keeps any other combination at `/compare?c=` with
  `noindex`.
- **Plan for 6–12 months of SEO before meaningful traffic.** Community posts
  (Reddit, forums) and price-drop alerts have to carry the early months.

## 3. The way in: used prices and timing

- **New prices are mostly flat.** Makers enforce minimum advertised prices
  (MAP), so the authorized dealers show the same new price except during the
  makers' instant-savings promotions. "Lowest new price" alone is a weak
  product.
- **Used and refurbished prices are where buyers save money, and almost
  nobody tracks them across retailers.** MPB publishes an index for its top
  100 products only. KEH has none. Forum threads asking where to see used
  price history go unanswered. One page showing new, used and refurbished
  prices across MPB, KEH, eBay, B&H used, Adorama used and Amazon, with
  history, is underserved. It is also exactly what the Compare framework
  already does: a daily import plus one history file per day.
- **Timing questions bring search traffic.** "Is now a good time to buy the
  a7 IV?" "What does a used a7 IV go for?" A successor's launch (the a7 V)
  pushes down the predecessor's used price, and the history shows it.
- **Price-drop alerts are RiftCompare's best-converting feature.** Sign-ups
  activate at 100% against 12% for the popup. They are the obvious next build.

## 4. Data: everything needed is available legitimately

| Need | Source | Status in this build |
|---|---|---|
| Dealer prices (B&H, Adorama, Best Buy, MPB, KEH) | **Affiliate-network product feeds** (Impact, CJ, Awin, FlexOffers): a daily file with price, UPC, MPN, condition and stock | Generic streaming feed importer, done (`src/lib/sources/feed.ts`). Each feed needs an approved affiliate account. |
| eBay new and used | Browse API with the EPN campaign, as RiftCompare runs it | Done (`src/lib/sources/ebay.ts`) |
| Amazon | Creators API (PA-API 5 shut down April/May 2026) | Written from the docs, untested until credentials exist (`src/lib/sources/amazon.ts`) |
| Specs | No free licensed database exists, so curated by hand: about 10–15 new bodies a year | 120 bodies drafted (2016+), schema-validated, cross-checked against Wikidata. **Verify against the makers' spec sheets before launch.** |
| Thumbnails | Wikimedia Commons photos found through Wikidata, with credits | Pipeline done; covers the cameras Commons has. The rest need press images, which is the owner's call (`docs/images.md`). |
| Barcodes (GTIN) for exact matching | Wikidata plus the feeds themselves | Filled where Wikidata has them |

Scraping is not an option. B&H and MPB return 403 to plain requests (tested
2026-10-17), and both have affiliate feeds anyway.

## 5. Cost: lower than RiftCompare's

There is no database. Catalog, offers and price history are JSON committed to
the repo. Pages are static and rebuilt once a day by the price import's
commit, so there are no Neon limits, ISR writes or egress to manage. The one
real cost: **Vercel's Hobby plan is non-commercial**, so an affiliate site
belongs on Pro, possibly the same team as RiftCompare.

## 6. Risks

1. **Affiliate approvals gate the data.** Most dealer prices only flow once a
   programme approves the site. Programmes judge a new site on its content, so
   apply as soon as the domain carries the catalog.
2. **Cookie windows are short:** Amazon 24 h, B&H ~60 h. Clicks have to come
   from people ready to buy, which favours price pages over spec pages.
3. **Wrong specs cost trust fast in this audience.** Hence the schema, nulls
   instead of guesses, and the Wikidata cross-check, but a human pass is
   still needed.
4. **SEO competition** (section 2).

## 7. Recommendation

Go, scoped:

1. **US first, camera bodies now, lenses next.** Lenses ship 10.6M units a
   year against 7.0M interchangeable-lens bodies, with even more used
   trading.
2. **Lead with prices:** new + used + refurbished, history, and drop alerts.
   Spec comparison supports the price pages; it is not the headline.
3. **Owner actions:** see `docs/OWNER-CHECKLIST.md`.
