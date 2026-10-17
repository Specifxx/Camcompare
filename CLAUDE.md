# Working in this repo

CamCompare: camera specs side by side, and new and used prices across US
retailers. A sister site of RiftCompare (Specifxx/TCGEmpire), built on its
Compare framework, minus the parts that cost RiftCompare money. Read
`docs/FEASIBILITY.md` for why it is shaped this way and `DECISIONS.md` for
the rules below.

## No database, on purpose

Everything public is JSON in `data/`, committed:

- `data/cameras/<slug>.json`: the catalog, one file per camera
  (`src/lib/catalog/schema.ts`);
- `data/brands.json`, `data/mounts.json`;
- `data/offers/latest.json`: today's offers, written by `npm run import:prices`;
- `data/price-history/YYYY-MM-DD.json`: each day's lowest new and used price
  per camera;
- `data/image-credits.json`: thumbnail credits (`public/cameras/<slug>.webp`).

Pages read these at build time and are fully static. **No page sets
`revalidate`**: data changes only through commits, and each commit is a
build. Don't add a database, an ISR interval or a request-time fetch for
public data without an entry in DECISIONS.md. RiftCompare's Neon egress and
ISR-write bills are the reason.

Builds: `refresh-prices.yml` commits prices to `main` once a day, and that
commit is the day's production build. `claude/*` and `ccr-*` branches don't
deploy (`vercel.json`).

## Catalog rules

- **Specs are facts from the maker's spec sheet. Use `null` rather than a
  guess.** A wrong number on a comparison page is worse than a dash.
- Cameras announced before `CATALOG_FLOOR_YEAR` (2016) need a `keepReason`.
- **Every published camera has a thumbnail and a credit.** A camera without
  them is unpublished, not shown with a placeholder (`docs/images.md`).
- `rivals` decides which `/compare/<a>-vs-<b>` pages exist. Only list
  cameras buyers really cross-shop. A pair is indexed only when both cameras
  name each other (`isIndexedPair`). Don't generate every pair: that is
  scaled content.
- After editing the catalog, run `npm run catalog:check`. It also runs first
  in `npm run build`.

## Prices and links

- Sources: `src/lib/sources/` (eBay Browse, Amazon Creators API, and
  affiliate-network product feeds). **Don't scrape dealers.** B&H and MPB
  block it, and each has a feed. See `docs/retailers.md`.
- Every listing goes through `matchListing` and `plausiblePrice`. Rules there
  may only refuse a listing, never loosen a match. Add a test in
  `tests/matching.test.ts` for any title you fix.
- Every outbound retailer link goes through `affiliateUrl` with a `subId` and
  `OutboundLink` (rel sponsored), and shows "Paid link" next to it when it
  earns.
- Offers are always sorted by price. Commission never decides order.

## Checks

```
npm run catalog:check
npm run typecheck
npm run lint
npm test
npm run build
```

Record non-obvious decisions in `DECISIONS.md` (newest at the bottom).
