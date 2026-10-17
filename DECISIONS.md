# Decisions

Newest at the bottom. Each entry: what was decided, why, and what would
change it.

## 2026-10-17: Founding decisions

**Context.** The owner asked whether RiftCompare's Compare framework could
carry a camera price-comparison site, and asked to build it if feasible.
Analysis is in `docs/FEASIBILITY.md`.

**Files, not a database.** RiftCompare's costliest lessons were database
transfer (Neon free tier exhausted every few days: TCGEmpire DECISIONS.md,
2026-09-11 and 2026-10-03) and ISR writes (~$10/day, 2026-10-17). A camera
catalog is small (hundreds of bodies) and prices change once a day, so all
public data is committed JSON and every page is static. A database comes back
only for private, per-user data (alerts, accounts), never for public reads.

**Prices from affiliate feeds and APIs, not scraping.** Camera dealers aren't
Shopify stores. B&H and MPB return 403 to plain requests (tested on this
date). Every dealer that matters publishes a product feed to approved
affiliates, with GTIN, MPN and condition, which also makes matching exact.
One generic streaming importer (`src/lib/sources/feed.ts`) reads Impact, CJ,
Awin and FlexOffers layouts.

**Amazon via the Creators API.** PA-API 5 was retired in 2026 (calls now get
403). The adapter follows the published Creators API docs and has not yet run
against a live account.

**Catalog floor 2016, with exceptions.** The owner said 2000s cameras aren't
needed. The schema rejects anything announced before 2016 without a
`keepReason` (the Sony a6000 stays: still sold new and a top used seller).

**No thumbnail, no listing.** The owner said every product needs a thumbnail.
Photos come from Wikimedia Commons through Wikidata, free licences only, with
credits stored and shown. A camera without a photo is unpublished rather than
shown with a placeholder.

**Indexed comparisons are curated.** Only the rival pairs named in the
catalog get an indexed `/compare/a-vs-b` page. Any other combination is
`noindex`. RiftCompare's SEO lesson ("one page per phrase; publish fewer
pages") and Google's scaled-content policy point the same way.

**Prices first, specs second.** Makers' minimum advertised pricing keeps new
prices at authorized dealers nearly identical, so a "lowest new price" alone
is a weak product. Used and refurbished prices across MPB, KEH, eBay and the
dealers' used departments, with history, are underserved. Those are the
headline. Spec comparison supports them.

**Specs are hand-curated and draft until verified.** No freely licensed
camera spec database exists. The first catalog was drafted from the makers'
published specs and cross-checked against Wikidata
(`npm run wikidata:crosscheck`). Unknown values are `null`, shown as a dash.

## 2026-10-17: First catalog, how it was checked

121 bodies across 10 makers. Most values come from the makers' own spec
pages (Nikon, Fujifilm, Ricoh, OM System, Sigma, Hasselblad, regional Canon
pages), with DPReview and press launch coverage for dates and prices.
Anything sources disagreed on is `null`.

Conventions the data follows. Change them only together with the data.

- `burstElecFps`: the fastest full-resolution electronic rate, crop modes
  included (Fujifilm's 1.29x figures), but not reduced-resolution JPEG modes
  (Nikon's C30/C60/C120).
- `video10bit`: internal recording only. 10-bit over HDMI alone is `false`.
- `afSubjects`: the maker's own categories. Canon's "vehicle" covers trains
  and planes, so it isn't expanded.
- `afPoints` for Canon mirrorless is the AF zone count. The compare table
  never ranks AF points, because makers count them differently.
- `batteryShotsCipa` is the rear-screen figure. DSLRs are rated through the
  viewfinder, so theirs are `null`.
- `launchPriceUsd` is body-only. A camera sold in the US only as a kit
  (D3500, Rebel T7, G100) gets `null`.

`npm run wikidata:crosscheck` linked 108 cameras and flagged 14
disagreements, all reviewed on this date:

- 10 are Wikidata quoting body-only weight (ours includes battery and card);
- the R5's "February 2020" was its development announcement;
- the Sigma BF and ZV-1 II Wikidata dates are wrong;
- the a7C II and a7CR Wikidata weights are wrong.

None changed the catalog.

Thumbnails: 110 of 121 cameras have a checked Commons photo. Two automatic
picks were wrong and were rejected:

- a landscape photo whose file name was a keyword dump including "rx100 vii";
- a photo of two different cameras.

The file-name filter now refuses both patterns. Wikidata also folds the Lumix
S5IIX into the S5II item, so `linkAll` now gives a shared item only to the
camera whose name is that item's label.

**One-sided rival pairs are noindex.** 275 rival pairs have a compare page,
but only the 120 where both cameras name each other are indexed and in the
sitemap. The rest keep their page for visitors, with noindex.

## 2026-10-17: 1,000 products, five markets, free with affiliate links and ads

**Context.** The owner asked to build the site out:

- about 1,000 camera products;
- "super sophisticated";
- free, with no freemium tier, paid by affiliate links and, later, ads;
- five main markets: the US, UK, EU, Australia and Singapore.

**What counts toward 1,000.** Camera bodies alone don't reach it, even back to
2012: about 355 relevant bodies exist across stills, compact, action, 360 and
cinema cameras. Lenses are camera products that buyers compare and that trade
used in large numbers (10.6M lenses a year against 7.0M interchangeable-lens
bodies), so the catalog is about 355 bodies plus about 650 lenses. Lenses have
their own schema (`lensSchema`), pages, compare tables and matcher rules.

**Catalog floor moved from 2016 to 2012.** Used prices are the site's wedge,
and 2012–15 bodies and lenses still trade used in volume (a7 II, D750, 5D III,
X-T1, EF 24-70 II). Older products still need a `keepReason`.

**Catalog authoring is a two-agent process per batch.** One agent writes the
files from the makers' spec pages. A second agent, told to assume there are
errors, checks every value against the maker's page and fixes or nulls it.
The conventions are in `docs/catalog-authoring.md`. Lens rivals are filled in a
separate pass across brands, so third-party lenses can be rivals of
first-party ones.

**Markets are URL prefixes: US at the root, then `/uk`, `/eu`, `/au`,
`/sg`.**

- Each market has its own retailers, currency, offers file and history
  directory.
- Prices are never converted between currencies. A feed row priced in another
  currency is refused (RiftCompare's CAD-as-USD lesson).
- A product page outside the US is noindex, out of the sitemap and out of the
  hreflang set until that market has an offer for it. Five near-identical
  copies of a spec sheet are what Google treats as duplicates.
- Those pages render on first visit rather than at build (`dynamicParams`), so
  the build stays at about one catalog's worth of pages, not five.
- `/compare/<a>-vs-<b>` pages are global: the specs don't change by country. The
  price row follows the visitor's chosen market in the browser, from
  `public/prices/<market>.json` built with the site.
- Market choice is remembered in a cookie and in local storage. A one-line
  banner suggests the visitor's country's prices (from Vercel's IP-country
  header via `/api/geo`). It never redirects: crawlers and travellers see the
  page they asked for.

**EU is one euro market.** The euro is shared and prices across Germany,
France, the Netherlands, Italy and Spain sit close together. Retailers keep
their own country, so the offer list says where each one ships from. Per-country
EU sites would multiply pages without adding much.

**Sources per market.**

- **Amazon:** the Creators API, with a credential per region (NA, EU, FE).
  ASINs are discovered by search and cached in `data/amazon-asins.json`, so a
  daily run is mostly batched `getItems` calls.
- **eBay:** one Browse API quota (5,000 calls a day) shared by four eBay sites,
  each walking the catalog in a daily window. Products not reached keep their
  earlier offers. There is no eBay Partner Network programme for ebay.com.sg,
  so Singapore has no eBay prices.
- **Dealers:** affiliate-network product feeds, one `FEED_URL_<KEY>` secret
  each. `tests/workflows.test.ts` fails if `refresh-prices.yml` misses one.
- **Shopify stores** (`products.json`): only where the store runs Shopify,
  robots.txt allows it, and it is a camera specialist (RiftCompare's method).

**Images.**

- **One credit file per product**, `data/image-credits/<slug>.json`, so
  parallel runs can't overwrite each other. Thumbnails moved to
  `public/products/` because lenses share the folder.
- **Sources, in order:** Wikidata's photo, then a Commons file whose name the
  matcher reads as the product, then Openverse (mostly Flickr; free
  commercial-use licences only).
- **Review:** anything found by search is checked by eye on a contact sheet
  before it ships (`npm run thumbs:sheet`). Rejected files are remembered in
  `data/image-rejects/` and never picked again.

**Ads are built in and switched off.** `AdSlot` renders nothing until
`NEXT_PUBLIC_ADSENSE_CLIENT` and a slot id are set. When they are, slots
reserve their height (no layout shift) and sit after the spec sheets and
listings, never beside a buy button, with no interstitials. These are
RiftCompare's AdSense lessons. `/ads.txt` reads `ADSENSE_PUBLISHER_ID`. Ads in
the UK and EU need a certified consent banner; AdSense's own is the simplest.

**Sophistication without opinions.** Every derived feature is arithmetic over
our own data, so nothing on the page is an invented score:

- **Peer rankings**, e.g. "lighter than 71% of full-frame mirrorless
  cameras".
- **Deal labels** compare today's price with our own history and need two
  weeks of it first.
- **The finder** ranks by stated spec rules and shows them under each pick.
- **Size comparison** draws the published dimensions to scale.
- **The saved list** stays in the browser: no accounts, no database.

**Guides.** Six evergreen guides (sensor sizes, mounts, lens names, buying
used, grey imports, when prices drop), each written by one agent and
fact-checked by another. They live in `content/guides/` and are rendered with
`marked`. Written content of this kind is what AdSense approval and long-tail
search need; RiftCompare's "publish fewer pages" lesson means six good ones,
not sixty.
