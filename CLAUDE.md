# Working in this repo

CamCompare: camera and lens specs side by side, and new, used and refurbished
prices at retailers in five markets (US, UK, EU, Australia, Singapore). Free,
paid by affiliate links and (later) ads. A sister site of RiftCompare
(Specifxx/TCGEmpire), built on its Compare framework minus the parts that
cost RiftCompare money.

Background: `docs/FEASIBILITY.md` says why it is shaped this way;
`DECISIONS.md` gives the rules below.

## No database for public data, on purpose

Public data has no database; private feedback uses one small Neon table
(`feedback`, `src/lib/feedback.ts`, `DATABASE_URL`), written by
`/api/feedback` and read only by the owner's `/admin/<ADMIN_KEY>` page. Nothing
public ever reads it. Everything public is JSON in `data/`, committed:

- `data/cameras/<slug>.json`, `data/lenses/<slug>.json`: the catalog
  (`src/lib/catalog/schema.ts`; how to write one: `docs/catalog-authoring.md`)
- `data/brands.json`, `data/mounts.json`
- `data/offers/<market>.json`: today's offers per market, written by
  `npm run import:prices`
- `data/price-history/<market>/YYYY-MM-DD.json`: each day's lowest new and used
  price per product
- `data/image-credits/<slug>.json`: thumbnail credits
  (`public/products/<slug>.webp`)
- `data/amazon-asins.json`: Amazon ASINs found per marketplace. Amazon's
  *prices* are never committed: its licence allows a price to be kept for 24
  hours, so each build fetches them into the git-ignored `data/offers-amazon/`
  (`scripts/fetch-amazon-prices.ts`), and they stay out of price history,
  deals, metadata and structured data (`lowest`, `isAmazonOffer`).

Pages read these at build time and are static. **No page sets `revalidate`.**
Data changes only through commits, and each commit is a build. Don't add a
database for public data, an ISR interval or a request-time fetch for public data without an
entry in DECISIONS.md: RiftCompare's Neon egress and ISR-write bills are the
reason.

Builds:

- `refresh-prices.yml` commits prices to `main` every three hours. Each commit
  is a production build.
- `claude/*` and `ccr-*` branches don't deploy (`vercel.json`).

## Markets

The US is the site root; the others live under `/uk`, `/eu`, `/au` and `/sg`
(`src/lib/markets.ts`). Pages are thin route files over shared views in
`src/views/`, which take a `market`.

- **Prices stay in their own currency.** Never convert one currency into
  another for display. A feed priced in another currency is refused.
- **Market product pages are noindex until priced.** A product page outside
  the US is noindex, out of the sitemap and out of hreflang until that market
  has an offer (`marketIndexable`). Keep that rule wherever a page is added.
- **Compare pairs are global.** `/compare/<a>-vs-<b>` pages exist once for
  every market; their price row follows the visitor's market client-side.

## Catalog rules

- **Specs are facts from the maker's spec sheet. Use `null` rather than a
  guess.** A wrong number on a comparison page is worse than a dash.
- Products announced before `CATALOG_FLOOR_YEAR` (2012) need a `keepReason`.
- **Every published product has a thumbnail and a credit.** A product without
  them is unpublished, not shown with a placeholder (`docs/images.md`). A photo
  found by search is checked by eye before it ships (`npm run thumbs:sheet`,
  `npm run thumbs:reject`).
- `rivals` decides which `/compare/<a>-vs-<b>` pages exist. Only list products
  buyers really cross-shop. A pair is indexed only when both products name
  each other (`isIndexedPair`). Don't generate every pair: that is scaled
  content.
- After editing the catalog, run `npm run catalog:check`. It also runs first in
  `npm run build`.

## Prices and links

- **Sources** live in `src/lib/sources/`:
  - Amazon Creators API;
  - eBay Browse;
  - affiliate-network product feeds;
  - Shopify `products.json`, only for camera shops that run Shopify and whose
    robots.txt allows it;
  - schema.org structured data (JSON-LD / OpenGraph product price) on a
    shop's own product pages (`src/lib/sources/structured.ts`), found through
    its sitemaps, only where robots.txt allows, one request at a time with a
    delay and a per-run budget. A feed or API replaces it when one exists.

  **Never Amazon or eBay pages** (their APIs only: Amazon's terms forbid any
  other price), **never past bot protection** (a 403, 429, Cloudflare
  challenge or captcha stops that shop, it is not worked around). See
  `docs/retailers.md`.
- **Matching.** Every listing goes through `matchListing` and `plausiblePrice`.
  Rules there may only refuse a listing, never loosen a match. Add a test in
  `tests/matching.test.ts` for any title you fix.
- **Links.** Every outbound retailer link goes through `affiliateUrl` with a
  `subId` and `OutboundLink` (rel sponsored), and shows "Paid link" next to it
  when it earns.
- **Order.** Offers are always sorted by price. Commission never decides order.
- **New feed retailers.** After adding one, run
  `npx tsx scripts/sync-workflow-feeds.ts` so the daily workflow gets its
  `FEED_URL_*` secret.

## Ads

`AdSlot` renders nothing until `NEXT_PUBLIC_ADSENSE_CLIENT` and a slot id are
set. Never place a slot beside a buy button or above a product's price, and
never add interstitials.

## Checks

```
npm run catalog:check
npm run typecheck
npm run lint
npm test
npm run build
```

Record non-obvious decisions in `DECISIONS.md` (newest at the bottom).
