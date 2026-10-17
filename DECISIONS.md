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
