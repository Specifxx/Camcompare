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

## 2026-10-17: Amazon rows without a price, eBay beside the table, filled buttons only when paid

Owner asked for Amazon in the price rows, eBay "on the side" until its API
keys exist, and the affiliate buttons highlighted. Three rules make that
honest:

- **Amazon "Check price" rows.** Amazon's Associates operating agreement
  allows a price on the page only when it comes from its API and is under 24
  hours old. The Creators API opens only after 10 qualifying sales in 30 days.
  Until then each product's Amazon row says "Check price" with no number: it
  links to the product's ASIN when `data/amazon-asins.json` knows it,
  otherwise to a tagged Amazon search. The row sits after the priced offers.
  A row with no price can't be sorted, and must not look like the cheapest.
  Other retailers marked `checkRow` get the same row until a feed prices
  them.
- **Amazon prices are fetched by the build, never committed.** The Creators
  API licence allows a price to be kept for 24 hours and shown with its time.
  A committed file keeps it forever in git history. So the daily import only
  finds ASINs (which may be stored, `data/amazon-asins.json`), and every build
  fetches that day's prices into the git-ignored `data/offers-amazon/`
  (`scripts/fetch-amazon-prices.ts`, which never fails the build). Amazon's
  price appears only where it is shown live: its own row and the price box,
  each with "as of <time>" and Amazon's disclaimer. A browser check hides it
  once over 24 hours old, in case no build has run since. It stays out of
  price history, deals, the saved list, metadata, structured data and the
  public price files (`lowest`, `isAmazonOffer`). The cost: the Creators API
  credentials live on Vercel as well as in GitHub.
- **eBay sits beside the table, not in it.** eBay listings are single
  sellers' auctions and used items, so they are a different kind of offer
  from a dealer's price. `EbayPanel` shows up to four Browse API listings.
  Before the keys exist it shows one tagged "Search eBay" link, which already
  earns through EPN. Singapore has no EPN programme, so no panel there.
- **Filled buttons only on paid links.** A retailer's button is filled in its
  brand colour (Amazon orange, eBay blue, accent for the rest) only when
  `isPaid` says the link earns. Unpaid links are outlined. The highlight
  follows the money, but the order never does: rows stay sorted by price, and
  every paid link carries the "Paid link" note.

Setup is a prompt for Claude in Chrome (`docs/chrome-setup-prompt.md`). It is
generated from the retailer registry (`scripts/gen-setup-prompt.ts`), so every
variable name in it matches the code. Site-ownership codes for Google, Bing
and Impact come from Vercel variables and render nothing until set; a
placeholder code fails verification silently.

## 2026-10-17: The matcher drops brand words from names and refuses unknown generations

A review probe showed that "Sony a7C II Body", "Sony A1 II", "Lumix S5 II" and
"OM-1 Mark II" matched nothing. The predecessor's brand-prefixed alias ("Sony
a7C") overlapped the successor's name without lying inside it, so both
survived and the listing was refused as ambiguous. The reverse failure was
worse: a generation missing from the catalog ("EOS R5 Mark II" when only the
R5 is listed) matched the older model, putting its price on the wrong page.

- **Names are matched without leading brand words** (`aliasKeys`). The brand
  is checked on its own, and only products whose brand the title names are
  candidates, so cutting the brand loses nothing.
- **A generation mark right after a name refuses the match** unless that
  longer name is in the catalog: "ii" to "ix" for anything; for bodies also a
  digit or a variant letter or word ("s", "r", "c", "pro", "max"…), except
  "E mount" and the like. A refused listing costs one offer. A wrong match
  costs trust.
- **A part number needs the brand in the title too.** Nikon's are bare 4- or
  5-digit numbers that other makers' accessories reuse.
- `catalog:check` uses the matcher's own keys, per brand, so a clash it
  passes can't make two products unmatchable.

## 2026-10-17: What the code review changed, and what it left alone

A six-part review (prices, markets and SEO, interface, security, cost, data)
raised 72 findings. Each was checked against the code by a second agent before
anything changed. Two weren't real. Most were fixed with tests. The decisions
worth keeping:

- **No launch price anywhere means no title-only prices.** 181 products had no
  US launch price. On a $30 token floor, lens hoods, tripod rings and main
  boards passed as the product. `plausiblePrice` now falls back to any
  market's launch price at reference rates. With none at all, it trusts only
  a barcode or part-number match. eBay matches only on titles, so it skips
  those products instead of spending quota on them.
- **"Paid link" follows the link, not only the environment.** An eBay or
  network feed link already carries the affiliate id the daily import ran
  with, and `isPaid(retailer, href)` sees it. The note and the filled button
  stay honest even when Vercel's variables lag GitHub's.
- **Junk first path segments are static 404s.** Every `[market]` page without
  a deeper dynamic segment sets `dynamicParams = false`, so `/wp-login.php`
  and `/favicon.ico` never render or cache anything.
- **Unpriced market product pages still render on first visit.** The cost is
  one render and one cache write per page per deploy, and only for pages
  something actually requests. The amplifier was link prefetching from the
  market hubs, which rendered every card on a visitor's screen; product cards
  no longer prefetch. Prerendering every market × product (about five times
  the build), or serving those pages dynamically behind a CDN header, would
  only be worth it if the Vercel usage page ever shows ISR writes mattering.
- **A reversed pair URL is a 404.** Every link, canonical and sitemap entry
  goes through `pairSlug`. Prerendering a redirect for each reversed slug
  would double the pair pages for URLs nothing produces.
- **Pages read at most 400 days of history** (`HISTORY_DAYS`). The folder
  still grows by one file per market per day. Merging old days into monthly
  files is the fix once that matters; until then the read is bounded.
- **One photo, one product.** A kit shot ("a6000 with 16-50mm lens") is the
  body's photo. The fetcher skips any photo another product already uses,
  matched by photo (Commons file, Flickr id), not file name.
- **Browse and finder state lives in the URL** (`history.replaceState`), so
  Back returns to the same filters and picks.

## 2026-10-17: Feedback in one small Neon table, read through a link-only admin page

The owner asked for a very visible way to send feedback and "a very special
hidden link, just a link only I can see" to read it, where anyone who has the
link can use it.

- **Neon for private feedback only.** One free Neon project (`camcompare`),
  one table (`feedback`, created on first use by `src/lib/feedback.ts`), the
  `@neondatabase/serverless` HTTP driver with `cache: "no-store"`. Public data
  still has no database: the founding rule stands. Nothing public reads the
  table; one INSERT per message and at most 500 rows per admin view keep
  transfer near zero.
- **Not GitHub issues.** The repo is public: issues would publish visitors'
  email addresses and let anyone read every message.
- **`/admin/<ADMIN_KEY>`, because the owner asked for a link, not a login.**
  The key is compared in constant time; a wrong key, or an unset or
  under-16-character `ADMIN_KEY`, is a 404. The right key sets an httpOnly
  cookie and redirects to `/admin`, so the key never stays in a URL that
  analytics or AdSense scripts can read (Google's ad crawler fetches the URLs
  its script sees). `/admin` is noindex, Disallowed in robots.txt, never in
  the sitemap.
- **Spam guards without a captcha:** a hidden honeypot (answered "ok",
  dropped), a 3-second minimum since the form opened, server-side length
  caps, JSON-only, and five messages per IP per ten minutes, in memory. IPs are
  never stored.
- **The floating button sits bottom left** (buy buttons are at the right of
  each offer row), lifts above any fixed bottom bar, and hides while an ad
  slot passes under it.

## 2026-10-17: Live prices from Shopify stores and shops' structured data (owner's request)

The owner: "the site has to have all the prices on the site scraped and live.
You can't just point to a site and say check the price." Feeds and APIs need
approvals and keys that haven't arrived, so every product page showed "Check
price" rows.

- **More Shopify shops.** Each checked for products.json, /meta.json in the
  market's currency and a robots.txt that allows it: Pictureline, Camera
  Wholesalers, Helix Camera, Shop Panasonic (US), Leica Store Miami, TK Foto
  (SG). Hunt's, Leica USA, Sigma America, Ted's (now), CameraPro and Ricoh
  Europe disallow products.json in robots.txt, so they are not read.
- **A structured-data source** (`src/lib/sources/structured.ts`): robots.txt
  Sitemap lines → product URLs whose slug the matcher reads as a catalog
  product → that page's schema.org Product/Offer JSON-LD (or OpenGraph
  product:price). Same matcher, price floor and currency rule as every other
  source. One request at a time, 1.5 s apart (or the site's Crawl-delay), a
  per-run page budget that rotates through the candidates; a 403, 429 or bot
  challenge stops the shop. A feed retailer with a structured config reads
  its pages only until its `FEED_URL_*` exists, never both.
- **Exceptions that stay:** Amazon is never read outside its API (the
  Associates agreement forbids showing other prices, and the account is
  shared with RiftCompare). eBay waits for Browse API keys. Shops behind bot
  walls (B&H's sitemaps, MPB, KEH, Best Buy, Wex, Park Cameras, CameraWorld,
  Clifton, LCE, Foto Koch, Foto Erhardt, Cyberport, Coolblue, Cameranu, Ryda)
  are skipped, not worked around: docs/retailers.md lists them.
- **Prices refresh every six hours** (refresh-prices.yml), so four data
  builds a day. CamCompare has no database or ISR, so a build costs build
  minutes only, not RiftCompare's Neon egress.

## 2026-10-17: Low light is linked, not guessed; used prices up front

From the first user feedback: comparing noise at ISO 6400 took "20 tabs", and
used prices matter more than new.

- **Low light & noise** on camera and pair pages: pixel pitch from the spec
  sheet (sensor area ÷ megapixels) as the one honest number we have, then
  links to sites that measure noise or shoot the same scene at high ISO.
  Photons to Photos' dynamic-range and read-noise charts are pre-filled
  with the models; DPReview's studio scene, reviews and video tests are also
  linked. Their samples and charts are theirs: we link, never copy them.
- **Used first-class**: a "Used price: low to high" sort, an "Available used"
  filter, and a "Used from" line on cards alongside the new price.
- **MPB and KEH** block automated reading (Cloudflare), so their used
  prices can only come from their affiliate feeds (Partnerize, Awin). The
  setup prompt now applies to those two first.

## 2026-10-17: www.camcompare.app is the canonical address

The site moved from camcompare.vercel.app to www.camcompare.app (the apex
redirects to www). `SITE_URL` defaults to the domain in code and ignores a
`*.vercel.app` value in `NEXT_PUBLIC_SITE_URL`, so a stale Vercel variable
can't point canonical tags, the sitemap or og:image at a deployment address
again. camcompare.vercel.app redirects (308) to the same path on the domain.

## 2026-10-17: "Should be worth" from used asking prices; prices every three hours

From friends' feedback (camera buyers): constant price updates, a "should be
worth" value, used prices over time, eBay sold prices, Facebook Marketplace.

- **Every three hours.** refresh-prices runs at :17 every third hour; each
  commit is a build. More often would mostly rebuild unchanged pages.
- **Should be worth, used**: each day's history now also keeps the median and
  count of used and refurbished asking prices (`usedMid`, `usedN`). The value
  is the median of those over 90 days, shown once a week of data exists, with
  a usual range (10th to 90th percentile), today's cheapest used against it,
  and a month-by-month table. Labelled as asking prices, because they are.
- **eBay sold prices** need the Marketplace Insights API, which eBay grants
  by application. The setup prompt asks for it alongside the Browse keys; the
  value switches to confirmed sales when access exists.
- **Facebook Marketplace: no.** It has no public listings API, needs a login,
  and its terms forbid automated collection. That fails the sources rule
  (never past a login or bot protection).

## 2026-10-17: A warmer, film-stock look

Friends' feedback: the site looked "too corporate". The palette moved from
SaaS blue to film stock (cream paper and rust in light mode, darkroom browns
in dark), headings to Fraunces, prices and spec lines to JetBrains Mono, and
cards to print and contact-sheet frames. Text contrast still passes WCAG AA;
green still means a price or a paid buy button.

## 2026-10-17: Price alerts by email, without accounts

Owner: "Tracking price option for every single camera" and "Price
notification for accounts". Accounts would mean passwords, sessions and a
login page for one feature, so the "account" is an email address and a
random token per alert.

- **"Track this price"** on every camera and lens page and in the quick view
  (`PriceAlert`): email, condition (new, used, either) and an optional target,
  prefilled 5% under today's lowest. Empty target means "any drop of 3% or
  more".
- **Double opt-in.** A new address gets one confirm email; nothing else is
  sent until it clicks. Confirming one alert confirms the address. At most 5
  unconfirmed alerts wait per address and 10 requests per IP per ten minutes,
  so the form can't be used to mail-bomb someone. 50 alerts per address.
- **Storage: one more private table**, `price_alerts`, in the feedback Neon
  project, created on first use. Still nothing public reads the database and
  no page reads it at build time; the only regular reader is
  `scripts/check-alerts.ts`, one SELECT every three hours, so transfer stays
  in kilobytes.
- **Checked after each price import**, in refresh-prices.yml, from the
  committed `data/offers/<market>.json` through `lowest()`: never Amazon's
  price, which may not be stored, and so is not emailed either. Notify when
  the price is at or under the target and lower than the last price emailed;
  never the same price twice; at most one email per alert per 24 hours; back
  over the target re-arms it. The step is `continue-on-error`: a mail
  failure never fails the price job.
- **Resend** (REST API, no SDK): free tier 100 emails a day, so a run sends
  at most 90 and leaves the rest for the next run. Every alert email has a
  one-click stop link (also as List-Unsubscribe / RFC 8058) and a manage
  link. The links carry the token; the manage page is dynamic, noindex and
  sends no referrer.

## 2026-10-17: RRP, bargains, price around the world, official pages

From friends' feedback (regional prices, RRP and used prices, "name and
shame" sellers over RRP, top bargains, graphs, links to makers' pages).

- **Price around the world** on every product page: each market's lowest new
  and used price in its own currency, and under it an approximate conversion
  into the page's currency, labelled "≈ at today's exchange rate", with a
  verdict ("Cheapest in Australia: about 12% under the US price before
  shipping and import tax") and a note that shipping, duty, GST/VAT and local
  warranty are not included (links the grey-market guide). This relaxes
  "never convert" for that one labelled panel only; every other price stays
  unconverted. Rates: ECB reference rates via frankfurter.app (free, no key),
  fetched into `data/fx.json` by `scripts/fetch-fx.ts` in refresh-prices
  (a failure keeps the last file and never fails the job); without the file,
  `refRate`. ECB rates change once a working day, so this adds at most one
  changed file a day to a price commit.
- **RRP** is the catalog's launch list price for the market, shown as
  "Launch RRP", next to "Used, typically" (the should-be-worth value) or
  "Used from" when there isn't a week of used data yet.
- **No naming and shaming.** Marketplace sellers are often private people;
  calling one out by name invites a defamation complaint and says nothing a
  price doesn't. Instead an offer row priced above the market's RRP gets an
  "Above RRP +N%" badge, and a used one above the typical used price "Above
  typical used price". Kits are never flagged (not the body's price).
- **Top bargains** (/deals and the home page): today's lowest in-stock,
  body-only, non-Amazon new price against RRP, and used against the typical
  used price, at least 5% under, biggest first (`topBargains`).
- **Official page links** go to the maker's own site search for the
  product's short name, only where the search URL pattern was checked
  against the live site (`search` in data/brands.json); the rest link to the
  maker's homepage ("Official site"). Not affiliate links: rel="noopener",
  not sponsored. Sony, Canon, Nikon, OM System, GoPro and Insta360 refused
  automated checks (403), so they stay homepage links until someone confirms
  their search URL by hand.

## 2026-10-17: Cash Converters, the plain board, and "doesn't work" listings

- **Cash Converters (AU, UK)** is read through the structured-data source:
  its robots.txt allows product pages, it has no feed or API, and its
  JSON-LD carries price and condition. Its product URLs are numbers, not
  names, so `slugless` reads a rotating sample of product pages and matches
  each on its own title; its sitemap index has hundreds of children (about
  90 MB), so `sitemapWindow` reads a different handful each run. Coverage
  builds up over several runs instead of all at once. One request at a time
  with the usual delay, so each AU and UK run takes about 20 minutes longer.
- **`/board` stays inside the main layout.** The friends asked for an "HTML,
  no JavaScript" page of just real deals. `/board` renders as plain HTML
  tables with no client components of its own, but still loads the site's
  shared script (header, feedback button, analytics): a separate root layout
  would mean moving every route into route groups, which isn't worth it for
  one page.
- **Listings that say a part doesn't work are refused.** "Canon (View Finder
  Doesn't Work) Canon EOS 90D" was matched as a working body. PARTS now also
  refuses "doesn't / does not / don't work", "not functioning", "defective"
  and "damaged". A "damaged box" new listing is refused too; refusing a real
  offer is the safe side of the matching rule.

## 2026-10-17: Camera accessories from listings we already download

Owner: "something that searches for camera accessories too, like film or
tripods … camera rigs and cages, and compare the prices of different
accessory brands"; then memory cards and SSDs by format with price per GB,
cables by spec, and lighting split by kind and camera system.

- **No new scraping targets.** The Shopify sources already download every
  product a shop lists, and the structured-data source reads pages from
  shop sitemaps. Listings `matchListing` refuses (or never matches) are
  offered to `classifyAccessory` (`src/lib/accessories.ts`); the ones it
  recognises go to `data/accessories/<market>.json`. The structured source
  spends only budget the catalog left unused (at most 60 pages a run) on
  sitemap URLs whose slug reads as an accessory, under the same robots,
  delay and bot-protection rules. Amazon and eBay: none.
- **Camera and lens matching is untouched.** The classifier only ever sees
  what matching threw away, and it is refuse-only in the same spirit: junk
  shop stock (binoculars, knives, TVs, laptops), "for parts", a listing that
  reads as a lens (focal length + aperture before any "for") or as a camera
  bundle ("… Camera + 64GB Memory Bundle"), a price over the category's cap,
  or a listing naming a catalog camera directly at a third or more of its
  launch price are all refused.
- **A camera is only attached when its brand is named** (or the accessory
  maker is that camera maker, or its model code appears), and a model
  followed by a generation the catalog lacks ("R6 Mark III") is not read as
  the older one. Film, cards, drives and cables never attach to a model.
  Flashes and triggers carry a camera *system* instead, from TTL suffixes
  (Godox V1-S, X2T-C, XPro-F, TT685II-O) or the title.
- **The kind named first is the product** ("FJ400 strobe kit with wireless
  trigger" is a strobe; "tripod with ball head and QR plate" a tripod); the
  category list order breaks ties ("battery grip" is a grip).
- **Specs come from the title only**: capacity (packs multiplied out),
  read/write MB/s (or "1800x"), V-class, VPG, UHS bus, card format
  (CFexpress Type A/B, SD, microSD, XQD, CFast); drive kind; HDMI ends and
  version, USB/Thunderbolt generation and Gbps, length. A CFexpress card
  whose type the title doesn't state is "type not stated", not guessed.
- **Caps keep the files reasonable** (about 3 MB for the US): per category
  the 300 cheapest, plus the 30 cheapest per category and camera, per
  category and flash system, and 8 per card/drive format and capacity (so big expensive cards aren't
  cut by the category cap). Same keep-on-error and 72-hour aging as offers.
  One listing per line in the file, for readable diffs.
- **Price per GB is tracked**: each import writes
  `data/accessory-history/<market>/YYYY-MM-DD.json`, the day's lowest
  in-stock new price and price per GB per format and capacity; the card and
  drive pages draw a small trend once a series has two days.
- **Pages are static** like the rest: `/accessories`, `/accessories/<category>`
  and the market variants, noindex and out of the sitemap until that market
  has listings in the category. Filters are client-side over the static
  list and kept in the query string. Camera pages get an "Accessories for"
  block (cheapest per category across shops and brands) only when something
  names that camera, plus flashes and triggers for its system.

## 2026-10-17: A deal feed that remembers, like OzBargain

Friends asked for a front page "like OzBargain": a feed you want to snatch
from, where a deal that sells says so when you refresh, and a historical price.

- **The memory is a committed public file per market**, `data/deal-log/<m>.json`
  (`src/lib/deal-log.ts`), updated by `scripts/update-deal-log.ts` right after
  the import in `refresh-prices.yml` and committed with the prices. No
  database, no request-time read: the page is still built from files.
- **A deal is product + condition + retailer**, found by `homeDeals` (cheapest
  in-stock, body-only, non-Amazon offer against this market's RRP, at least
  5% off). It stays live while that retailer still has it in stock in that
  condition and it still saves 5%, even if another shop undercuts it (the
  cheaper one becomes its own deal). It goes **"sold"** when the retailer no
  longer has it in stock and **"expired"** when its price leaves deal
  territory; gone deals are dropped after 7 days, and the page shows those
  gone in the last 48 hours, greyed with a plain "Sold" or "Expired" label (no stamps or stickers: owner, "UI needs to be cleaner"). A relisted deal is a fresh
  find. A price drop keeps `firstSeen` and records `was` ("price dropped ·
  was $X"); a rise clears it.
- **No URLs and nothing of Amazon's in the file**: the page wraps the live
  offer's own link at build time (`affiliateUrl` + `subId("home", "feed")`,
  `OutboundLink`, "Paid link"), and `lowest` already leaves Amazon out.
- **Times are the import's own** (`generatedAt`), so a rerun is stable; the
  browser turns them into "found 3h ago" / "gone 2h ago".
- **Historical price** on each row: a sparkline of up to 90 days of our own
  daily lowest for that condition and "lowest in 90 days" only with at least
  14 days of history, plus a link to the product page's price history.
- Sort tabs Hot (biggest %), New (first seen), Biggest $ off; filters by
  used/new and camera/lens. Each row's title says the whole deal ("Sony α7S
  II body — used $895 at Camera West (RRP $3,000, save 70%)").

## 2026-10-17: Logo iris on transforms, suggested kits, a reviews hub

Friends' feedback; owner: "UI needs to be cleaner. No random shapes and graphics."

- **The iris animates with `transform` only.** It used to animate the CSS `d`
  property, which Safari and every iOS browser ignore, so the mark never
  opened there. Each blade is now a 60° cone (apex on a hexagon round the
  centre) clipped to the circle, the six drawn as one shape turned 60° apart
  (`components/brand/Logo.tsx`). Opening slides each apex out from the
  centre: one `translate`, the same in every blade's own frame, so a single
  keyframe serves all six. 0.6 s, once, nothing else (no twist, no hover);
  still under reduced motion. Checked frame by frame in Chromium and WebKit.
- **Suggested kit** (`lib/kit.ts`, `components/SuggestedKit.tsx`) is a rule,
  not a recommendation engine and not AI: native autofocus lenses only (no
  APS-C lens on full frame), by 35mm-equivalent range on that body: a
  standard zoom, a fast prime (f/2 or brighter, nearest 50mm), and a
  telephoto zoom, else a wide. Each role has a target share of the body's
  price and a cap (new today, else used, else launch, in the market's own
  currency); priced lenses, the maker's own (or its mount alliance: L-Mount,
  Micro Four Thirds), then Sigma/Tamron/Samyang/Zeiss/Tokina/Viltrox, current
  over discontinued. The reason sentence states only what the spec sheet
  shows; it never says "most people buy". Prices are today's lowest new
  (non-Amazon, as `lowest`), never converted; the total says when it leaves
  unpriced items out. Fixed-lens bodies and mounts without such lenses get
  nothing rather than a weak kit.
- **Reviews hub** (`lib/reviews.ts`, `components/ReviewHub.tsx`) links to
  each review site's own search for the product, built from its name
  (`searchName`, shared with `lib/lowlight.ts`). Nothing is copied or
  fetched: a review's words are its site's. Each pattern was opened with a
  camera and a lens name and returned that site's results: Digital Camera
  World, Camera Labs, Imaging Resource, Amateur Photographer, YouTube,
  Reddit r/photography. Left out: DPReview and PetaPixel (their search
  answers with a Cloudflare challenge, 403; DPReview stays in the Low light
  panel as before) and the Lensrentals blog (it has no search URL).


## 2026-10-17: Community v1 (accounts, comments, votes, CamKarma, reviews, boards)

Owner approved, from friends' asks: a comment section on every listing, up/
down votes on deals, "feel like Reddit", CamKarma for upvoted comments, a
CamExpert badge, open boards and user reviews. Then: "UI needs to be cleaner.
No random shapes and graphics."

- **User-generated public content goes in Neon, read by client fetches.** It
  changes by the minute and can't be commits, so it is the one exception to
  "no database for public data": the community tables sit in the existing
  `DATABASE_URL` project (no new project). Pages never read them at build
  time or on the server; components load after render (`Discussion` only
  when scrolled near). Public GETs carry `Cache-Control: public,
  s-maxage=30, stale-while-revalidate=60` and nothing about the visitor, so
  the CDN answers almost every read; per-member data (who am I, my votes, my
  review) is separate `no-store` endpoints, skipped entirely for signed-out
  visitors (no `cc_member` hint cookie). Hiding a post therefore takes up to
  ~90 s to leave caches.
- **Thread and member pages are static shells** (`/community/t`, `/u`) that
  `next.config.js` rewrites `/community/t/<id>` and `/u/<name>` onto: a new
  thread or member costs no build, ISR write or server render. They are
  noindex (content rendered in the browser). `/community` and the five board
  pages are static, indexable, in the sitemap, with a static intro.
- **Magic-link sign-in.** 32-byte tokens, stored as SHA-256, single-use by an
  atomic UPDATE, 15 minutes. The link opens `/community/signin`, which POSTs
  the token: mail scanners that prefetch links can't spend it. Sessions are a
  random token in a cookie signed with HMAC(`AUTH_SECRET`), httpOnly, Secure,
  SameSite=Lax, looked up by hash (so sign-out and bans end them). Without an
  AUTH_SECRET of 32+ characters sign-in is off with a clear message; reading
  works. Limits: 3 links per address per 15 minutes and 10 per IP per hour
  in the database (the IP stored as an HMAC), answers identical whether or
  not the address is a member.
- **Writes:** zod, text cleaned (tags, control and bidi characters stripped)
  before length checks, rendered as text nodes with only http(s) autolinks
  (`rel="nofollow ugc noopener"`). Every write needs a same-origin `Origin`
  (and `Sec-Fetch-Site: same-origin` when sent) and JSON. Posting: 6 per
  member and 20 per IP per 10 minutes per instance, plus 8 posts per member
  per 10 minutes across instances (counted in the database).
- **Votes** are ±1, one per member per comment, review, thread or deal,
  changeable and removable; no voting on your own posts. Scores are always
  summed from the votes (no stored counter to drift) and ignore banned
  members' votes. One level of replies; a reply to a reply attaches to its
  top-level comment. One review per member per product (posting again
  replaces it).
- **CamKarma** = votes on a member's visible comments and reviews; never deal
  or thread votes. **CamExpert** = `CAMEXPERT_KARMA` (50) CamKarma and an
  account `CAMEXPERT_MIN_ACCOUNT_DAYS` (14) days old, both in
  `lib/community/rules.ts`; shown as a plain text badge.
- **Votes and superlikes never decide the order of offers or deals.** Deal
  votes are displayed only. Premium is not built; `docs/premium-plan.md`
  keeps any paid superlike cosmetic for the same reason as "commission never
  decides order".
- **Moderation.** Report on every comment, review and thread (signed-in, once
  per member per post). 3 distinct reporters hide a post until the owner
  looks, because the owner isn't always watching. `/admin` lists open reports
  and the newest posts with hide/unhide, ban/unban and dismiss; the buttons
  post to `/admin/moderate` (under `/admin` because the admin cookie is
  scoped to that path; same cookie check, same-origin). Hidden posts and
  everything by a banned member disappear from every public read; banning
  ends their sessions.
- **Owner notices are bounded** (`notifyOwnerBounded`, `lib/community/notify.ts`):
  one email per event to `OWNER_EMAIL` through Resend, at most 20 reports,
  10 new posts and 5 new members a day (UTC), counted in `community_notices`
  so every instance shares the cap; the last one says the cap was hit.
- **Plain UI.** Text, thin rules, small ▲▼ arrows, "[CamExpert]" in text, no
  decorative shapes, gradients or paper effects, per the owner's feedback.

## 2026-10-17: Plain and clean, replacing the film-stock look

Friends' verdict on the film-stock look ("A warmer, film-stock look", above):
"UI needs to be cleaner. No random shapes and graphics." It is replaced:
Inter for all text (Fraunces, JetBrains Mono's display use and Caveat are
gone), an off-white page with white panels, neutral greys and 1px borders,
one accent (the logo's rust) and green only for money. No light leaks,
bokeh, grain, gradients, viewfinder corners, film frames, tape, tilted
photos, stickers, marquee or scroll animations. The only motion left is the
logo's one-off aperture opening, which friends liked. A new decoration needs
a reason a buyer would care about.

## 2026-10-17: Blue and green brand colours

The owner liked the blue and green (the link-preview image, the favicon and
the green savings), so the brand is built around them instead of rust. Blue
(`--c-accent`, #1d47d1 light / #7ea4ff dark) is the brand: the logo iris,
"Compare" in the wordmark, links, active tabs, focus rings and primary
buttons. Green (`--c-buy` / `--c-win`) stays the colour of money: savings,
lowest prices and paid buy buttons, plus the one green blade of the iris.
The favicon and the link-preview image swap their orange for the same
green. Everything else stays neutral grey, as in "Plain and clean".
