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
  one email per event to the owner through Resend, at most 20 reports,
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

## 2026-10-18: A little motion, same plain look

Friends: "looks way better… maybe make it a bit animated, same format but some
things moving… something needs to move… maybe just mouse hover animations or
just the logo shutter blinks." This relaxes "the only motion left is the
logo's one-off aperture opening" in "Plain and clean", without bringing back
any decoration. The logo's shutter blinks every 12 s and on hover. Cards lift,
and their photo leans in, on hover. Deal rows deal in one after another, tint
on hover and nudge their saving. Buttons press in, nav underlines slide in,
vote arrows pop, and a green live dot breathes beside "Prices last checked".
Sections below the fold fade up as they scroll in (`Reveal.tsx`). It hides
nothing before its script runs, so crawlers and no-JS visitors see
everything. Transforms and opacity only, under 0.6 s, and all of it is off
under prefers-reduced-motion.

## 2026-10-18: Deal votes in every market

The owner: "the upvotes and downvotes should be on all regions". Only the
US and UK have the RRP deal feed, and the votes lived only there. Now every
deal row and card in every market carries `DealVotes`: the home page's
fallback lists and every list on /deals. Keys are `<market>:<slug>:<list>`
(drop, used-drop, used-vs-new, store-gap, bargain-new, bargain-used), so a
product's votes on the home page and /deals are the same votes.

A market without launch prices or a week of history (Singapore today) had no
deals at all, so nothing to vote on. A third list needs neither: "One store
clearly cheapest" (`storeGaps`), today's cheapest new, body-only, in-stock
price at least 5% under the cheapest at any other store. Europe still shows
nothing, because no European store prices anything yet.

Found on the way: Cash Converters Singapore (Shopify, second-hand only)
doesn't tag stock as used, so every listing came through as new.
`storeCondition` makes an untagged listing at a store that sells no new gear
the store's own condition.

## 2026-10-21: One contact address, in code

Owner notices went to `OWNER_EMAIL`, a Vercel variable holding the owner's
personal address. The site now has its own: `CONTACT_EMAIL`
(`camcompareapp@gmail.com`, `src/lib/site.ts`). Owner notices always go to
it, every email sent to visitors (alerts, sign-in links) carries it as
`reply_to`, and the privacy page names it. It is a constant, not a
variable, so a stale personal address on Vercel can't override it;
`OWNER_EMAIL` is no longer read.

Product pages: the price history chart moved from below "Where to buy" and
"Price around the world" into the header, under the price box, so it shows
without scrolling.

## 2026-10-21: Member stories, My gear, a request board, digicams and viral cameras

Owner asks: a user blog like a shop's product-review blog, a collection
tracker ("my entire camera and lens collection is like up… it's like my
stock portfolio… probably up 2x"), the founder story on /about, a public
"feedback and request section", a digicam page and "viral cameras rn".

- **Member stories (`/stories`) live in the community tables**, under the
  same exception as comments: `community_posts`, read only by client
  fetches through CDN-cached `/api/community/stories` GETs; `/stories`,
  `/stories/new` and the `/stories/p` shell (a rewrite, like `/community/t`)
  are static. Votes (`post`), comments (target `post:<id>`), reports, hide
  and ban reuse the community's code paths, as do the posting limits, plus
  3 stories per member per day. New stories notify the owner (the bounded
  `post` notice). Story votes don't earn CamKarma (unchanged rule: comments
  and reviews only). `ProductStories` lists a product's stories.
- **Bodies are a Markdown subset parsed into a tree** (`lib/community/stories.ts`)
  and rendered as React elements: headings, lists, quotes, bold, italic,
  code and http(s) links (`rel="nofollow ugc noopener"`). No HTML is ever
  inserted, and sanitizeText still strips tags first.
- **Images: one cover per story, shown only once the owner features it.**
  Uploads need storage we don't have, so a cover is an https address on a
  real host name (no IPs, localhost, ports or credentials). A hotlinked
  image can be swapped for anything after it's checked and it tells the host
  who is reading, so: no pictures inside bodies (image syntax becomes a
  link), the cover is stored but the public API returns it only for featured
  stories, rendered lazily with `referrerpolicy="no-referrer"`, and an
  author's edit unfeatures the story until the owner looks again.
- **Stories are noindex unless featured.** The shell's HTML has no robots
  tag (a noindex there would stop crawlers rendering featured stories too);
  the page's script adds `noindex` for anything not featured, and a canonical
  for featured ones. Featured stories list first. They aren't in the sitemap
  (that would be a build-time database read); `/stories` links them.
- **My gear (`/collection`) works signed out in localStorage**, and signed in
  syncs to `community_collection` (one private JSONB row per member, read
  only through the member's own no-store `/api/community/collection`). A
  browser that never synced adds its items to the account's once; after
  that the account's list wins, so a deletion elsewhere sticks.
- **Values are static JSON from the build** (`scripts/build-values.ts`,
  `lib/gear-values.ts`): `public/values/<market>.json` (typical used, lowest
  new) and a per-product value series, daily for 28 days and weekly before,
  each point the typical used price as it stood that day (else that day's
  lowest new). Items are valued in the market they were priced in; totals
  are per currency, never converted. Faulty gear isn't valued, and the
  condition otherwise doesn't adjust anything: we don't guess discounts.
  The "sell or keep" line appears only when the typical used price is above
  what was paid, never off a new price.
- **The request board (`/requests`)** is `community_requests` with votes
  (`request`), comments under each and an owner status (open, planned, done,
  won't do, with a public note) set from `/admin` through `/admin/curate`
  (same admin-cookie guard as `/admin/moderate`). The private feedback form
  stays and links to it.
- **`/digicams` and `/viral-cameras`** are static per-market pages from the
  catalog and offers: digicams are every `compact`, grouped by sensor size,
  plus older ones with a used price; the viral list is `data/viral.json`
  (owner-edited, slugs checked by a test). Stock notes come from the offers'
  optional `availability` (backorder, pre-order) and in-stock flags, Amazon
  left out. Both sit in the header's new "More" menu (the phone nav had no
  room for more links) and the footer.

## 2026-10-22: Product pages like a shopping panel, one rule for every "best price"

Friends filmed Google's product panel for "r50 canon" in Australia: "I want
this entire thing… except including second-hand, including the user
reviews". Camera and lens pages now follow its order: buy first, then
reviews and things to know, then the rest.

- **Hero.** The photo (a gallery: `data/gallery/<slug>.json` may add more
  licensed, credited photos later; none exist, so it is one photo today), the
  name, our members' star average (client-loaded once the page is idle,
  hidden with no reviews), "Typically X–Y" (20th to 80th percentile of
  today's one-price-per-store body-only new prices pooled with 90 days of
  daily lows; at least four numbers or nothing), the best price with its tag
  and one "Best price at <store>" button, then Track price, Compare, Save.
  That button is filled even when its link doesn't earn: an exception to
  "filled buttons only when paid", because price alone picks it, and "Paid
  link" still shows when it earns.
- **Where to buy** has filters (All, New, Used & second-hand, Refurbished,
  Kits). Rows show stock (in, low, preorder, backorder, out) in colour, "N%
  off" with the struck-through was-price only when the store gives one, the
  promotion as a badge, the detail, and the kit's lens. Identical listings
  (same store, condition, price, stock, pack, seller, mount, detail, promo,
  was-price) merge into one row, "×N listings". Each row is rendered once;
  the filters hide rows by CSS (`lib/offer-tabs.ts`), so the HTML carries
  only the first five body-only rows and three kits of each filter, and
  "Show N more" loads the rest from the static quick-view file
  (`MoreOffers.tsx`). Those rows keep the quick view's affiliate sub-id.
- **One rule for every lowest, cheapest and best price** (`lib/price-rules.ts`).
  The R50's Australian page listed used and kit prices while "Price around the
  world" said "Not priced in Australia yet": the panel counted body-only
  offers and found none. Now the hero, the table's "Best price" tag, cards,
  the quick view, the world panel, metadata and JSON-LD all use: cheapest
  in-stock body-only new, else used; a kit is never the body price, and when
  a market has no body-only price at all the cheapest kit (new first) shows,
  labelled with its lens (`kitLensName`, else the catalog lens, else the
  focal lengths in the title). The world panel shows kits marked "kit", and
  its verdict never says "not priced" for a market with offers ("only kits
  are priced", "priced used only", "out of stock everywhere"). JSON-LD stays
  body-only, so a kits-only page has no Product offer: a kit is a different
  product. Tests: `tests/product-page.test.ts`.
- **Reviews**: our members' average, histogram and the community Reviews
  component (top or newest), "What people are saying" counted from members'
  own words (topics mentioned, and whether mostly in 4-5 or 1-2 star
  reviews; hidden under three reviews), and the critics as links
  (`reviewLinks`). Nothing copied from other sites. The hero's stars and the
  section share one fetch of the CDN-cached reviews API; that hero fetch is
  the one community read a visit makes without scrolling, bounded by the
  API's 30-second CDN cache.
- **Things to know** (`lib/things-to-know.ts`): bullets from spec-sheet facts
  and today's offers (kits on sale, used value, successor, same-line
  siblings), and "Good for / Not the best for" from fixed thresholds, each
  naming the spec behind it. A null spec says nothing.
- **Videos and discussions** are links (`lib/media-links.ts`): YouTube
  searches, the maker's official channel where one was checked, Reddit
  searches in the brand's or mount's subreddit plus r/photography (and
  r/videography for 10-bit bodies), DPReview's forum index (its search
  answers bots with a challenge), and our members' comments, loaded when
  scrolled near. No embeds until the catalog holds a specific video ID.
- **More options**: successor, same-line siblings, predecessor and rivals as
  cards with today's price and "Newer model" / "N% under RRP" badges. It
  replaces the "Compare the X" buttons (each card links its comparison).
- An in-page nav (sticky under the header on wide screens) and a marked slot
  for the history agent's price history. "Lenses for the X" shows three per
  group instead of four, for weight.

## 2026-10-22: Australian stores, offer detail from the sources, and one accessory section per kind

Friends who buy and resell cameras in Australia asked for "OzBargain +
camelcamelcamel + price checker + availability tracker". The offer schema
had just gained optional `wasPrice`, `availability`, `kitLens`,
`kitLensName`, `promo` and `detail`. This entry is about filling them, and
about the stores and the accessories.

- **Only the store's own data.** `wasPrice` is Shopify's `compare_at_price`
  when it is above the price, a JSON-LD `priceSpecification` with priceType
  StrikethroughPrice or ListPrice, or a feed's full price when its sale price
  is lower. AggregateOffer `highPrice` is never one: it is the dearest
  variant, not a former price. Never a launch price or RRP from the catalog
  (`src/lib/sources/detail.ts`).
- **Availability.** Shopify: `available` false is out of stock; then a
  pre-order or back-order named in tags, title or product type (JB Hi-Fi's
  `AwaitingStock` tag is back-order); low stock from a tag or an
  `inventory_quantity` of 3 or fewer. A description counts only when it
  plainly says so about this item ("this item is available for pre-order"):
  store boilerplate like "pre-order items ship when…" or "ETA varies" appears
  on every page. JSON-LD and feed values map one to one (LimitedAvailability
  is low stock). Pre-orders and back-orders are shown but `inStock: false`, so
  they never set a lowest price.
- **Kit lens** (`kitLensOf`, `src/lib/matching.ts`). `kitLensName` is the
  lens as the title names it whenever it gives a focal length. `kitLens` is
  set only when exactly one catalog lens for the camera's mount fits: by
  alias, else by focal range (and aperture, when given) among the camera
  maker's lenses. Two Canon RF 24-105mm lenses start at f/4, so "w/
  24-105mm" names no slug; a twin-lens kit names none either. One-way like
  the matcher: it refuses rather than guesses, and it changes no match.
- **Promo** is the piece of the title, tag or description sentence that names
  a bonus, cashback, gift card, trade-in bonus or Giftober, at most 120
  characters. "Free" counts only when something is given free, never "free
  shipping" or "hands-free".
- **Detail**: the variant (not "Default Title"), the branch (Cash Converters
  pages name it), the grade ("EX+", "Grade 9/10", "Mint in Box"), the
  shutter count, then the serial. It is filled whenever the store says one of
  these, so the product page can tell identical rows apart.
- **Stores** (docs/retailers.md, "Australian stores checked"). Ted's is now
  read through its sitemaps and `/products/<handle>.js`. Its robots.txt
  disallows `/*?limit=`, which keeps the paged products.json out, but it
  allows sitemaps and product pages. The same sitemap mode reads JB Hi-Fi,
  whose ~108,000-product catalogue is mostly music and TVs. Only handles the
  matcher reads as a catalog product (or an accessory) are fetched, on a
  rotating budget, and unread products keep their offers (`covered`). Camera
  House's JSON-LD is read until its Commission Factory feed. The Good Guys
  (robots.txt disallows `/products/`), Harvey Norman (Imperva on every page,
  JSON-LD price 0), BIG W (drops requests) and Bunnings (Cloudflare
  challenge) are refused and listed as feed retailers with a `disabled`
  reason.
- **robots.txt line endings.** Broadway HK's robots.txt ends lines with bare
  CRs, which the parser read as one line, i.e. no rules. It now splits on CR,
  LF and CRLF (RFC 9309): stricter, never looser.
- **Accessories: the owner's sections.** /accessories is now grouped by the
  owner's list, one section per line: gimbals, cages, drones, PTZ cameras and
  monitors; cables, tether cables and batteries; flashes, backdrops, tripods
  and bags; filters, LED lights and modifiers; video transmitters and
  switchers; cards, SSDs and SATA drives; recorders and matte boxes; audio
  recorders, shotgun and wireless microphones. Every category shows in every
  market, "None listed yet" where a market has none; the sitemap still lists
  only categories with listings, and an empty category page stays noindex.
  New categories: drones, PTZ cameras, tether cables, backdrops, video
  transmitters, video switchers, recorders (split from monitors), matte boxes
  (split from cages), audio recorders, shotgun and wireless microphones
  (split from microphones), and action camera mounts. No existing slug was
  removed, so no URL or stored row is lost. Drones were junk before; now a
  drone is a drone, but a drone's battery, propellers or ND filters are a
  battery, a part or a filter (a category's `not` guard reads the title
  before "with", "+", "combo" or "("). An LED light's grid, dome or barn
  doors are modifiers. New brands: Teradek, Accsoon, Vaxis, AKG, Neumann,
  Sound Devices, Comica, Azden, Movo, Roland, RGBlink, OBSBOT, PTZOptics,
  BirdDog, Lilliput, Desview, Autel, Potensic, Holy Stone, Hubsan, ARRI,
  Cooke, DZOFilm, Fujinon, and RED, matched only with one of its product
  names, never the colour.
- **"Osmo Pocket 4P" is not the Osmo Pocket.** A model number with a letter
  after a camera's name (`4P`) is now a model we don't list, like a bare
  digit already was, and is refused. A resolution is not ("R5 8K", "a7 IV
  4K"). It refused 16 stored listings, all Pocket 4P combos that sat on the
  original Osmo Pocket's page.
- **A short model code is no proof of brand.** A model code in the title used
  to stand in for the brand, so JB Hi-Fi's "QED SS20 2-Way Speaker Switch"
  matched Panasonic's S 20mm (code S-S20, "ss20"). The code now counts only at
  6 or more characters. Over all stored offers it refused three listings, all
  wrong: a signed print, a headset and a case, each matched to a Nikon lens
  through a short numeric code.
- **Japan and Hong Kong**: researched, not added (docs/retailers.md).

## 2026-10-21: Just announced, and alerts for stock, preorders and makers

The owner's friends: "almost a news marketplace". Makers "randomly release
things… nobody's out here waiting and checking". A Godox flash found five
hours late and bought from a scam reseller, an FX5 preorder gone in ten
minutes. So: a page of announcements with the stores that take orders, and an
email when something can be ordered.

**Sources.** `scripts/fetch-releases.ts` reads makers' own channels and
newsrooms (`src/lib/releases/brands.ts`, 44 makers, 51 YouTube channels, 4
newsroom RSS feeds). Every channel was resolved and fetched on 2026-10-21; 29
are linked from the maker's own website, the rest found by YouTube's channel
search and checked by eye. Dropped: @SonyAlpha (last upload 2009), @Canon (no
uploads), Canon Global (2013), LUMIX USA (one video), Ricoh Imaging Americas'
old channel (2016), @PENTAXofficial (a fan channel), "Walden Harris" behind
@nikonofficial. Newsrooms: Nikon imaging, Panasonic (LUMIX items only),
Ricoh Imaging Americas, Hollyland and Apple (iPhone and camera items only)
work. Sony, Canon USA, GoPro, Insta360 and Fujifilm answer 403, and Samsung's
robots.txt disallows us: not worked around. No maker's launch-page sitemap
was usable, so none is read. AKG (403, no official channel found) and
Bronica (a dormant Tamron brand) aren't watched.

**YouTube's robots.txt disallows `/feeds/videos.xml` for every crawler.**
The feed is still the one each channel page links for feed readers, but our
rule is "only where robots.txt allows". So the script reads uploads through
the YouTube Data API when `YOUTUBE_API_KEY` is set (free key, 1 quota unit per
channel, ~410 of 10,000 a day at every three hours), and reads the public
feed only when `RELEASES_YOUTUBE_RSS=1` says the owner chose to. The first
data/releases.json was made that way, by hand, to check the feeds.

**The file.** One release per line: id (`r` + 12 hex of the URL, slug-safe
for alerts and comment targets), brand, title, url, time, video id, the
catalog products it names, and `isAnnouncement`. A launch word without a
tutorial, firmware or corporate word, tested in tests/releases.test.ts.
Announcements are kept six months, everything else three weeks, so a
heuristic miss can still be fixed. Products are matched with `matchListing`
plus an alias search for the release's own brand only. A name followed by a
variant or generation word doesn't count: `matchListing` itself takes "DJI
Osmo Pocket 4P" as the original Osmo Pocket, which the sources agent may
want a test for. The script runs before the price commit and writes only
when something changed, so a release rides the price commit: **no extra
build.** The page is static (no revalidate); comments load only when a
card's Comments button is pressed (`release:<id>` targets).

**Where to buy** comes from our offers and counts **stores only**: never eBay,
never a marketplace seller, never Amazon (`lib/releases/stock.ts`). The
friend's scam is exactly what it must never point at. A market's /releases
is noindex until a store there lists something on it.

**Alerts.** `price_alerts` gains `alert_type` (price, restock, preorder,
brand; old rows default to price) and `last_state`, added in place with
`ALTER TABLE … ADD COLUMN IF NOT EXISTS`. "Any price drop" and "Only deals
under a price" are the old no-target and target alerts. Restock and preorder
fire on a **transition** against the state stored on the alert: the last
import's view, which survives skipped imports and counts the watch check's
runs too. The previous offers file isn't diffed, since a git diff is wrong
whenever a commit is skipped. A preorder alert can be on a release card
before we list the product: it fires once a store lists a product the
release names. Brand alerts keep the newest announcement time they reported.
Bounds: 90 emails a run, 3 per address a run, time-critical kinds first,
3 h between stock emails, 2 h between brand emails, 24 h between price
emails. Every email has the one-click stop link.

**Instant-ish checks (built, off).** `scripts/check-watched.ts`, behind
`WATCH_CHECKS=1`, re-reads only the stored store listings of products with
restock or preorder alerts: Shopify `/products/<handle>.js`, structured-data
pages. Same robots and bot-wall rules, at most 60 pages a run and 12 per
store. It emails through the same `runAlerts` and writes nothing, so it
commits and deploys nothing. At 30 minutes: free Actions minutes (public
repo), one Neon SELECT a run, zero Vercel builds. Its workflow and the
premium plan are in docs/premium-plan.md.

## 2026-10-21: Price history backfill from archived store pages, a camelcamelcamel-style chart, and the Global price comparison page

Friends: "The price history is flat for all the cams." "Is it not able to back
search? Like camelcamelcamel." A camera bought at $1k dropped $300 a week
later and had sold for $800 two months earlier; they want "tell me if it
ever drops below $900". We had five days of our own history.

- **Backfill from public archives of our own retailers' pages, never from the
  stores.** `scripts/backfill-history.ts` reads two archives, both of which
  crawl only where a store's robots.txt lets them: the Internet Archive's
  Wayback Machine (CDX API for captures of Shopify `/products.json` and
  `?page=N`, `/products/<handle>(.json|.js)` and product pages; raw bodies from
  `/web/<ts>id_/`), at most one request a second, backing off on 429/503 and
  giving up after five refusals in a row; and Common Crawl
  (data.commoncrawl.org, a public dataset): each monthly crawl's sorted index
  searched by HTTP range reads of its `cluster.idx`, then each product page's
  WARC record range-read. Only stores in `RETAILERS` with a Shopify or
  structured source; never Amazon, eBay or link-only shops; Keepa,
  camelcamelcamel, PriceSpy and the like are never scraped. CDX answers and
  parsed snapshots are cached (`BACKFILL_CACHE`), so reruns are cheap.
- **Same matching as live.** Every archived listing goes through
  `matchListing`, `shopifyCondition`/`storeCondition` and `plausiblePrice`
  (`lib/price-history-backfill.ts`): kits, other currencies, out of stock (when
  the page says so), conditions the store doesn't sell and implausible prices
  are refused. A `/products/<handle>.json` capture doesn't say whether it was
  in stock: counted (it was the advertised price). HTML entities, hex ones
  included, are decoded first (Ted's JSON-LD names read
  "Sony&#x20;A7&#x20;Mark&#x20;V"; the live `pageListings` has the same gap).
  Older themes put the price elsewhere, read in order when JSON-LD gives
  none: a JSON-LD Offer the strict parser rejects (by pattern), schema.org
  microdata, Shopify's `og:price:*`, Magento's final-price box; the currency
  must be on the page. In the chart, an archived price under 55% or over
  170% of the product's archived median (four or more points) is left out
  (`dropArchiveOutliers`, about 0.5%: unlabelled bundles, deposits); the
  file keeps it.
- **First run (2026-10-21/22), Common Crawl only.** web.archive.org was
  unreachable from the session that ran it (every connection reset; the
  availability API on archive.org answered), so the Wayback half is written
  and tested but has not run: it should run from GitHub Actions. Common
  Crawl, 30 crawls since October 2023, 21 stores: 507 products with at
  least five archived days in at least one market (AU 446, US 265, SG 169,
  UK 21), about 13,000 points. Stores whose pages Common Crawl hardly has,
  or that block it (Challenger), stay thin; Camera Wholesalers, Helix,
  Shop Panasonic, Leica Store Miami and the structured US stores were still
  to do when the run was stopped, and a rerun picks them up (per-store done
  markers in the cache).
- **Stored apart and always labelled.** `data/price-history-archive/<market>/<slug>.json`,
  committed, one point per day and store: `{day, new?, used?, store,
  source: "archive", snapshotUrl}`, the URL being where anyone can check it
  (a Wayback URL, or a Common Crawl WARC file with offset and length). Our
  own `data/price-history` is untouched, and `historyFor` (deals, PriceBox,
  used value) still reads only what we recorded: archived points are sparse
  (a capture every few weeks) and would make "dropped this week" signals
  lie. Only the chart merges them (`mergeArchivedHistory` in `lib/offers.ts`;
  a day we recorded wins over an archived one).
- **The chart is a client component over a static file.**
  `scripts/build-history-data.ts` (in `npm run build`, after
  `build-public-data.ts`) writes `public/history/<market>/<slug>.json`
  (git-ignored, CDN) with recorded and archived days and today's lowest new
  and used with the store, never Amazon. `components/PriceHistory.tsx`
  fetches it after the page renders: ranges 1M/3M/6M/1Y/All; lowest, typical
  (median of daily lows) and highest for new and used; a crosshair tooltip
  with the store and date; recorded series solid, archived dashed with
  hollow dots and the legend "From archived store pages (Internet Archive,
  Common Crawl)"; and "Is this a good price?" (`priceVerdict`, `lib/value.ts`):
  today's price against the last six months, "Lower than 80% of the last 6
  months", the typical and the lowest, with a link that opens the page's
  "Track this price" form. No revalidate, no server fetch; the HTML carries
  none of the history.
- **Price traps** (`lib/price-traps.ts`, `components/PriceTraps.tsx`,
  `components/PairPriceHistory.tsx`): for indexed rival pairs and
  predecessor/successor links, flag when the newer model costs more new today
  than the older one (often on promo), with both histories on one chart. The
  friends' case: the Canon R6 V at A$3.5k against the R6 Mark III at A$3k on
  promo, while reviewers called the R6 V the cheaper one.
- **Global price comparison page** (`/world`, `/world/<brand>`,
  `/world/<brand>/<line>`; `lib/world.ts`, `components/WorldTable.tsx`), like
  the "Sony G Master global price comparison" posts buyers share: per product
  line, the US list price (catalog launch USD) and today's lowest new price
  in each market, converted into the currency the visitor picks (USD first;
  the picker is client-side, rates from `data/fx.json`), each figure marked ≈
  with the store's own price and name under it, the cheapest in green, and
  the most it saves against the US list. **The second place a converted price
  is allowed** after "Price around the world" (CLAUDE.md updated): it is the
  page's whole point, and the conversion is labelled on every figure. The
  caveats (exchange rate, tax and duty, shipping, regional warranty, link to
  the grey-market guide) sit on every page. Japan and Hong Kong, the markets
  buyers compare against most, aren't markets yet: `WORLD_COLUMNS` lists them
  as planned columns that render the day they exist. DJI, GoPro and
  Insta360 lines are included: DJI gear is hard to buy in the US. A line
  with nothing priced is noindex.

## 2026-10-22: Accessory photos are the store's own listing photo, hotlinked

The owner: "the accessories need photos as well". Every accessory row (the
`/accessories/<category>` pages and a camera page's "Accessories for the …")
now shows a small square photo.

- **Whose photo.** The image the listing itself carries: Shopify's variant
  image, else the product's first (`variantImage`), or the JSON-LD `image` on
  the store's product page. Feeds would give `image_link`, but feed sources
  make no accessory rows today. Nothing is guessed or searched for.
- **Why this differs from catalog products.** A camera or lens page's
  thumbnail is ours: it stands for the product on every page, so it must be
  licensed and credited (docs/images.md). An accessory photo is the store's
  picture of its own offer. It shows only beside that store's row, links to
  that store's page, and is credited "Image: <store>" (the title on hover),
  the way shopping comparison sites show a merchant's photo. Nothing is
  copied: it is hotlinked from the store's CDN, never stored in the repo,
  never through Vercel's image optimiser (`<img>`, not `next/image`), with
  `referrerPolicy="no-referrer"`.
- **Small.** It shows at 56 px and asks the CDN for a 160 px image
  (`?width=160` on cdn.shopify.com and a shop's /cdn/shop/ path), about 4 KB
  instead of 40 KB. It is lazy-loaded, decoded asynchronously and fixed in
  size, so rows don't shift. A missing or broken image shows a neutral icon
  for the category's section.
- **Compact in the data.** `image` is stored without the scheme or the
  query string, and Shopify's `cdn.shopify.com/s/files/` becomes `~`
  (`compactImage`, `accessoryImageUrl` rebuilds it).
- **Off with one flag.** `ACCESSORY_IMAGES` in `src/lib/accessory-format.ts`:
  false shows the icon everywhere. The import keeps storing the field, so
  turning photos back on needs no new run.
- Rows written before this have no image until the next price import, every
  three hours. A backfill would mean re-reading every Shopify store's
  products.json and every structured-data page, which is a price import.

## 2026-10-22: Unofficial images are fine: a store's photo until a licensed one

Owner, 2026-10-22: "unofficial images are fine". Half the catalog (513 of
995 products) had no licensed thumbnail and so no page. Now a product with no
licensed thumbnail shows a store's own listing photo of it, the same way
accessory and second-hand rows show theirs ("Accessory photos are the
store's own listing photo", above).

- **Which photo.** From a new, body-only, in-stock, non-Amazon offer: a
  maker's own store first (Canon Store, Sony Store, Shop Panasonic…), then an
  authorized dealer, then any store, ties by retailer and listing id
  (`pickStorePhotos`). Never a second-hand listing: that photo is one unit,
  with its marks, not the product. Never a kit.
- **How it reaches pages.** The import writes `data/store-photos.json` (slug
  → photo URL, store) after each run. `next.config.js` turns each entry into
  a redirect from `/products/<slug>.webp` to the store's CDN at 640 px, so
  cards, the quick view, the picker, OG and JSON-LD images pick it up with no
  change and nothing is copied. A map shipped to the browser would have meant
  changing every thumbnail call. The product page credits it "Image:
  <store>".
- **Licensed photos always win**, checked at every build: no redirect when
  `public/products/<slug>.webp` exists (redirects run before files), and the
  catalog ignores a store photo for a product with a credit.
- **Publishing.** `lib/catalog/index.ts`: published = licensed thumbnail, or a
  store photo. Neither: unpublished, as before. `ACCESSORY_IMAGES` turns
  store photos off with the rest.
- **Data.** Sources keep a new offer's photo only for products without a
  licensed thumbnail, so the offer files grow only there. Second-hand offers
  keep theirs always.

## 2026-10-22: 2025-26 launches, and the matcher rules they needed

Friends reported "r6v camera is missing": the catalog had no camera announced
after December 2025. Added 22 bodies announced October 2025 – October 2026
(EOS R6 V, R8 Mark II, α7R VI, RX10 V, FX5, Z5IIC, Lumix L10 and ZS300, OM
SYSTEM PEN, GR IV Monochrome, SL3-P, M EV1, Osmo Pocket 4 and 4P, Osmo 360 II,
Osmo Action 6, Insta360 X6, Luna Pro and Ultra, GoPro MISSION 1, 1 PRO and 1
PRO ILS), specs from the makers' spec pages and manuals.

- **`1/1.1-inch` is a sensor format.** DJI's and Insta360's square sensors
  (Osmo Action 6, Osmo 360 II, X6) are 1/1.1-type; filing them as 1-inch
  would have been a wrong number. Area 106 mm² for ranking only.
- **Micro Four Thirds takes 1-inch bodies.** The MISSION 1 PRO ILS puts a 1"
  sensor behind an MFT mount, so `mounts.json` lists the format and MFT-lens
  coverage includes it.
- **A model that is an everyday word keeps its brand** (`WORD_MODELS` in
  `lib/matching.ts`: "pen", "max"). With the brand stripped, "OM SYSTEM PEN"
  would have matched every Olympus PEN E-PL listing. "GoPro MAX" now needs
  "GoPro" right before "MAX"; its "MAX 360" alias is unchanged.
- **Panasonic DMC- is the old naming.** A title naming "DMC-<model>" is
  refused for a product with no DMC- part number, so a 2007 Lumix DMC-L10
  DSLR is never priced as the 2026 Lumix L10.
- **Commons "test shot(s)", "test" and "P mode" file names are sample photos**
  (`SAMPLE_SHOT`): every GR IV Monochrome file on Commons was one.

## 2026-10-23: eBay across the site, tagged searches until the Browse API

The owner's EPN campaign (5339155912) is hard-coded, and the owner asked for
"everything eBay-wise on the site, so I actually get some affiliates". With
no Browse API keys we have no eBay prices, so every placement is a tagged
search, never a price (`src/lib/ebay-links.ts`).

- **Product pages: an "On eBay" card beside Where to buy**, never inside the
  price-sorted rows: search used (`LH_ItemCondition=3000`), search new
  (`1000`) and recently sold (`LH_Sold=1&LH_Complete=1`, the "what should it
  be worth" check), in Cameras & Photo (625). Live listings, when the keys
  arrive, sit on top as before. eBay left "Also check" on the product page
  and in the quick view: the card replaces it. The Used filter ends with
  "More used … on eBay"; the quick view has the used and sold searches.
- **Elsewhere, at most one eBay block per section:** accessories (the
  category, then the brand and camera the filter picks, filled in the
  browser from a server-tagged template, `lib/ebay-template.ts`, so the
  page doesn't carry a link per camera); the camera page's accessories;
  "Used on eBay" on used deal rows and used bargains and on older digicams;
  "Hard to find new? Try eBay" on viral cameras; "What it sells for on
  eBay" per My gear item; one "Shop used cameras on eBay" strip on the home
  page. Digicam cards and new-price deal rows get none: it would be a link
  on every card.
- **No EPN banners or scripts.** EPN doesn't reliably offer banners to new
  publishers, and a third-party script is weight and a privacy cost. Each ad
  position (`AdOrPromo`) shows the AdSense slot when one is configured, else
  `EbayPromo`, our own "Shop on eBay" box labelled "Paid link · eBay Partner
  Network". Same positions, so the ad rules hold (never beside a buy button
  or above the price). The guide pages keep the bare AdSlot: they have no
  market, and a US eBay link would be wrong for most readers.
- **Categories.** eBay US ids from eBay's own Cameras & Photo category list
  (tripods 30090, drones 179697, batteries 162045…). Other eBay sites number
  some leaves differently, so outside the US a search narrows to 625 only;
  drives and audio recorders get no category.
- **Tracking.** Each placement has its own customid (`product-ebay-used`,
  `product-ebay-sold`, `qv-ebay-used`, `acc-ebay`, `acc-ebay-camera`,
  `camera-acc-ebay`, `deals-ebay-used`, `digicams-ebay-used`, `viral-ebay`,
  `gear-ebay-sold`, `home-ebay`, `promo-<where>`). `subId` now cuts a long
  page name instead of the placement, which a 60-character cut used to lose.
- **Disclosure.** "Paid link" beside every eBay link, `rel="sponsored
  nofollow"` through `OutboundLink`, an EPN paragraph on `/disclosure`, and
  the footer line "We earn from qualifying purchases through affiliate
  links, including eBay Partner Network" linking to it. Commission still
  never orders offers. Singapore shows no eBay at all (no EPN programme).

## 2026-10-25: Indexing: canonicals, hreflang and internal links

Search Console (owner, 2026-10-25): 1.58K indexed; 851 "Excluded by
noindex", mostly `/compare?c=…` and regional copies; 112 "Discovered, not
indexed"; 57 "Crawled, not indexed"; 77 "Duplicate without user-selected
canonical". The sitemap has about 3,460 URLs. A local build crawled with
the sitemap and every server-rendered link found:

- Every sitemap URL returned 200, was indexable and was its own canonical,
  and every regional product page's hreflang was reciprocal with x-default
  on the US page. No noindex URL was in the sitemap.
- The noindex pages Google keeps finding are the ones we link: about 2,960
  `/compare?c=` builder links on indexed pages ("Compare side by side" on
  every More options card), 870 `/stories/new?product=` links, and about
  1,900 links from regional lists to that market's page of a product it
  doesn't list (noindex, rendered on demand). Each is a crawl spent on a
  page that won't be indexed, and the regional ones a server render too.
- The only server-rendered pages without a canonical were noindex ones
  (saved lists, the story editor, alerts, sign-in) and the client-rendered
  shells (`/community/t`, `/u`, `/stories/p`).
- `/world` and its 25 brand and line tables were linked only from the
  JavaScript More menu: no server-rendered link reached them.
- `/cameras` and `/lenses` render their first 240 cards (newest first), so
  about 130 cameras and 400 lenses had no link from their hub, only from
  brand and mount pages, three clicks from the home page.

**Regional pages keep hreflang with self-canonicals; they do not canonical
to the US page.** A UK page is a different page for a different buyer: its
prices are in pounds, from UK stores, and its overview, offers, deals and
price history are the UK's. A cross-market canonical would tell Google to
drop the UK page and show UK searchers the US page in dollars, and Google
ignores hreflang between pages that canonical elsewhere. The duplication
risk is handled where it already was: a market's product page is indexed,
in the sitemap and in hreflang only once that market lists the product
(`marketIndexable`), and global pages (pairs, guides, `/world`, the
community) exist once with no hreflang. Unchanged; now tested
(`tests/seo.test.ts`: every sitemap URL resolves to indexable metadata
whose canonical is itself and whose hreflang targets are all in the
sitemap).

**`/compare?c=` stays noindex, follow.** Any combination a visitor builds
is not a page to rank; the curated rival pairs at `/compare/<a>-vs-<b>`
are. Links to the builder now carry `rel="nofollow"` (More options,
"Compare with …" when the pair isn't indexed, the pair page's "Add a
third"), as do "Write a story" links, the footer's Saved link, and every
link to a market's page of a product that market doesn't list
(`ProductCard`, the related lists, the A-Z index, the overview; the summary
carries `indexed`, the same rule as the noindex). nofollow is a hint to
spend crawls elsewhere, not a block: the pages stay crawlable, so Google
still sees their noindex, and robots.txt still doesn't disallow them.

**Every product is linked from its hub and from its neighbours.**

- `/cameras` and `/lenses` end with an A-Z index: every published product,
  by brand, as plain links in the server HTML (`CatalogIndex`). One
  complete list instead of paginated `/cameras/page/2` URLs: no thin
  listing pages to index, and every product two clicks from the home page.
- Product pages add "Alternatives to the …" (`lib/related.ts`): cards for
  similar products of any brand (same class and sensor, or same coverage,
  zoom-or-prime and focal range; close in megapixels or aperture, launch
  price and year), then plain lists of more from the same maker and more
  for the same mount, each ending in a link to the brand or mount page. No
  product appears twice on a page (More options is excluded). The picks
  use catalog facts only, not today's offers, so they are the same on
  every market's page and don't reshuffle with each import.
- The footer links All cameras, All lenses, Brands and Prices around the
  world.
- Breadcrumbs (Cameras / brand / product, with BreadcrumbList JSON-LD)
  were already on every product page.

**An overview in sentences on every product page** (`lib/overview.ts`):
what it is (format, sensor or focal range, mount, maker, date, successor),
who it suits (the Things to know fits), today's price in this market (the
range across stores with it in stock, used from, the 90-day usual range
from our history, the launch price), or where else it is listed when this
market has none, and three products to compare it with. Generated from the
catalog, offers and history, never written by hand, in the market's own
currency only. It is what separates a UK page from the US one in words,
and what an unpriced page has besides its spec table.

**Duplicates.** Query variants (`?mount=`, `?camera=`, `?ref=`) canonical
to the page without the query, `/cameras/` redirects to `/cameras`, and
`/us/…` is a 404. Now also: the bare `camcompare.app` host redirects to
www in `next.config.js` (as `camcompare.vercel.app` already did), in case
Vercel's domain settings ever serve it instead; the JSON the pages fetch
(`/history`, `/offers`, `/prices`, `/values`, `/search-index.json`) is
sent with `X-Robots-Tag: noindex`; and the noindex pages that had no
canonical got one. A member story stays client-rendered with its noindex
or canonical set by its script (2026-10-21, "Member stories, My gear…"),
so a featured story can still be indexed.

Not fixable here: the live site answered every request from our container,
robots.txt included, with Vercel's bot challenge (429,
`x-vercel-mitigated: challenge`). Vercel lets verified crawlers through,
but if Attack Challenge Mode or a firewall rule covers Googlebot, crawling
slows and pages queue as "Discovered". The owner should check that in the
Vercel Firewall and with Search Console's live URL test.

## 2026-10-26: IndexNow, like the sister sites

CamCompare was the only site in the family that never told Bing about new
or changed pages; it waited for Bing to find the sitemap on its own. Bing's
index also feeds DuckDuckGo, Yahoo and Ecosia, and IndexNow reaches Yandex,
Seznam and Naver in the same request, so it is the cheapest search traffic
there is. The code is MTG Compare's, unchanged in behaviour:
`/indexnow.txt` serves the key (`src/lib/indexnow.ts`, CamCompare's own,
`INDEXNOW_KEY` overrides it), and `indexnow-submit.yml` sends every URL in
the live sitemap once a day at 07:41 UTC. The job reads the key from the
live file, so it needs no secret, and fails red when a batch is refused or
the key file is not live.

Once a day, not after every three-hourly price commit: the URL list is the
whole sitemap, and resubmitting it eight times a day would read as spam to
IndexNow. If the Vercel bot challenge noted on 2026-10-25 blocks the engines'
fetch of `/indexnow.txt`, the job fails with a 403 and the owner sees it.

## Compare Empire family links — 2026-10-27

The owner, once YGO Compare existed: "our website should all have all of our
compare websites now in the suite of websites … just try to backlink all of
it." Every site's footer now links the other eight: RiftCompare, OP Compare,
DexCompare, MTG Compare, Gundam Compare, Lorcana Compare, YGO Compare
(ygocompare.com), CamCompare (www.camcompare.app) and Compare Empire
(www.compareempire.com, Australian tech prices), each on the host it already
uses (no apex or www change). Plain followed links, never sponsored: they are
our own sites. The link text says what each compares ("Yu-Gi-Oh! card prices",
"Camera and lens prices"), with the site's name after it, rather than the
brand alone. MTG Compare is sealed-only since 2026-10-21, so its anchor now
says "Magic: The Gathering sealed prices" everywhere.

Footer only. In-page blocks ("Compare other TCGs" on card and product pages,
the article blocks) keep to card games, and the two sites that are not card
games are labelled as the wider family, so nine look-alike sites linked from
every page body never read as a link network.

`FAMILY_SITES` in `src/lib/site.ts`, drawn as one row under the footer's
columns (`tests/family-sites.test.ts`). Not retailer links, so they do not go
through `affiliateUrl` or carry "Paid link".

## Used price guide — 2026-10-27

The owner took the affiliate-channels review's recommendations ("let's
implement all of this"). Its idea #3 was a used camera price guide. eBay is the
largest used camera market, so a used sale there pays like dozens of card sales
on the card sites. Most of it was already built: every product page has "Used:
what it should be worth" (`usedValue`, 2026-10-17), and the deals page has used
bargains. What was missing was one page that answers "what are used cameras
worth" for every model.

`/used` (and `/uk/used`, `/eu/used`, `/au/used`, `/sg/used`), `src/views/UsedView.tsx`.
It lists every camera and lens with a week or more of used asking prices in
that market, most-listed first. Each row shows the typical used price (90-day
median), the usual range (10th to 90th percentile), today's cheapest used offer
and its store, and a tagged eBay used search (`used-<market>` / `used-ebay`,
with the Paid link note). It is static, built from the committed history like
every other page. It is labelled as asking prices, not sales, because eBay's
sold data still needs Marketplace Insights approval.

A market's guide is noindex and out of the sitemap until it has ten products
(`USED_MIN_ROWS`, `tests/used-guide.test.ts`). On 2026-10-27 that meant 324 in
the US, 225 in the UK and 221 in Australia, but 10 in Singapore and none in the
EU. It is linked from the header's More menu. The US page is about 1.3 MB of
HTML, in line with /cameras and /lenses.

## Drones and smart glasses — 2026-10-30

The owner asked for drones ("really big in the industry now") and smart
glasses. Both are cameras, so they are two new camera `type`s, `drone` and
`smart-glasses`, not a third product kind: they reuse the camera page, offers,
price history, alerts, compare pages, Amazon and eBay links, and the stores'
existing listings. Drones were already arriving as unmatched listings in the
/accessories "Drones" section (about 500 a day across the US, Australia and
Singapore); now the models in the catalog get product pages, and the rest stay
in /accessories.

- **Catalog.** 11 DJI drones (Mini 3 Pro, Mini 4 Pro, Mini 5 Pro, Mini 4K,
  Flip, Neo, Air 3, Air 3S, Mavic 3 Pro, Mavic 4 Pro, Avata 2) and 5 Meta
  glasses (Ray-Ban Meta Gen 1 and Gen 2, Oakley Meta HSTN and Vanguard, Meta
  Ray-Ban Display), with the new brand `meta`. Specs are from launch coverage
  of the makers' figures, `null` where not confirmed. The Mini 5 Pro and
  Mavic 4 Pro were never sold officially in the US, so they carry EUR/GBP
  launch prices and no US one. Like every product, each publishes once a store
  photo or licensed thumbnail exists: the first import after the merge.
- **New specs, all optional:** `flightTimeMin`, `rangeKm` (FCC),
  `obstacleSensing` (drones only), `batteryHours` and `ipRating` (glasses),
  shown in a "Flight & wear" spec group that is hidden wherever it is empty.
  `sensorFormat` is nullable, for camera glasses only (Meta doesn't publish
  it); `four-thirds` joins the formats (Mavic 3 and 4: same size as Micro Four
  Thirds, which is not what DJI calls it). Pixel pitch, peer ranks and the
  stills-camera "Things to know" rules are not shown for either type; drones
  get flight time, range, obstacle sensing and the 250 g line instead.
- **The headline price of a drone is its base pack:** the drone with its
  standard remote (RC-N or RC 2), or the drone alone where that is how it is
  sold. Fly More, Creator and other combos, the RC Pro, store bundles and any
  listing that adds cards, cases, batteries or care plans after the drone's
  name are bundles (`kit: true`), shown under "Bundle" and never the headline.
- **Matching** (`src/lib/matching.ts`). A drone or glasses title says what is
  in the box ("with DJI RC-N3 Remote", "with Charging Case"), so the accessory
  rules read only the title's head, before "with", "+", "(", a comma, " - " or
  "combo", as /accessories already did; a part, plan, lens or accessory brand
  in the head is refused. "Mavic 3 Pro Cine", "Classic" or "Enterprise" are
  other drones and are refused. "DJI Flip" and "DJI Neo" need the brand right
  before the word, like "GoPro MAX". Ray-Ban Meta Gen 1 and Gen 2 share frame
  names, so a Ray-Ban Meta listing must name its generation ("Gen 2", "2nd
  Gen") and is matched to that generation; one that names none is refused.
  Checked against ~300 real drone titles from the stored accessory listings,
  and against all 12,555 stored offers: none moved to a new product.
- **eBay.** Drones stay in Cameras & Photo (Camera Drones is inside it).
  Camera glasses are not in Cameras & Photo, so their eBay searches and Browse
  calls have no category; the matcher still decides.
- **Pages.** `/drones` and `/smart-glasses` (and each market's), from
  `GADGET_PAGES` in `src/lib/curated.ts`, in the More menu, the footer, the
  homepage hero line and the sitemap (once priced). `/cameras?type=drone`
  filters too. The main nav is unchanged: its phone row is full.

## Blog posts with live prices, featured on the home page — 2026-10-30

The owner asked for many more blog posts ("best drone prices", "best cameras of 2026") and for them to be
featured on the home page so they get crawled. Posts are guides with `kind: blog` in their front matter
(`content/guides/*.md`, same `/guides/<slug>` URLs, so nothing new splits a query); the plain explainers stay
`kind: guide`. `/guides` lists the posts first.

A post never types a price or a spec. Whole-line blocks (`src/lib/guide-blocks.ts`, drawn by
`src/components/GuideBody.tsx`) fill in at build from the catalog and offers, so every price commit refreshes
them: `[[picks:slug,…]]` (a card per product: specs, the cheapest in-stock body-only US new price with its
store through `affiliateUrl` and `OutboundLink`, "Paid link" when it earns, used, then the other markets each
in its own currency), `[[top:type=…,sensor=…,max=…,since=…]]` (the same, chosen by today's US price),
`[[specs:slug,…|key+…]]` (a table from `SPEC_GROUPS`) and `[[deals:n=…]]` (DealsView's bargains). A product
not yet published (the drones, until their store photo arrives) keeps its spec row with no link and no
price, never a guess. `tests/guide-blocks.test.ts` checks that every product a post names exists.

The three newest posts get cards right under the hero, above the deal feed; every other post and guide
stays in the list further down. Posts that don't repeat a list page: "best X of 2026" is not `/drones`
("drone prices") or `/digicams`, and none is a head-to-head, which `/compare/<a>-vs-<b>` owns.

## Amazon and eBay pinned above the price rows

2026-10-30, owner: Amazon and eBay must be "at the very, very top" of every product page and quick view,
always shown, in a bright colour, not lost under a dozen dealers.

So both open the price list (`PinnedMarkets` in `src/components/OfferRows.tsx`), above the New / Used /
Kits filters, Amazon first and eBay second. Each is shaped like an offer row, tinted in its own colour
(Amazon orange, eBay blue, with a stripe on the left and a coloured "Ad" label), with its own filled
button. Amazon shows its live price with its time when the Creators API sent one (the row stays in the
sorted list too, where its price belongs), otherwise "Check price", the tagged link that used to sit in
"Also check". eBay shows today's cheapest live listing, otherwise a tagged search.

The store rows keep their price order, the "Best price" tag and the headline; nothing pinned is counted
as a store. This is the one exception to "commission never decides order", and only because the pinned
rows sit outside the sort and say they are ads. Placements are `pinned-amazon` / `pinned-ebay` and
`qv-pinned-*`, so the click log shows what the pin earns.

## 2026-10-30: eBay calls are capped per day, split across the three-hourly runs

The eBay source ran inside every three-hourly import with `EBAY_MAX_CALLS` (4,600) split only across
markets, so once keys are set it would have spent that eight times a day. The owner's plan (2026-10-30) is
a new keyset shared with K Young, 2,500 calls a day each. `ebayRunBudget` now divides `EBAY_DAILY_CAP`
(default 2,500; a repository variable can only be set by the owner's decision) by `EBAY_RUNS_PER_DAY` (8)
and by the eBay markets, about 78 searches per market per run, and the rotation window moves every run.
Nothing calls eBay until `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` exist as GitHub secrets.

## One eBay campaign for every Compare site, hard-coded — 2026-10-30

**Decided (owner).** Every Compare site now sends eBay clicks to ONE EPN campaign, 5339155912 (RiftCompare's,
already set up), hard-coded in the code: no variable overrides it any more, so a forgotten secret or Vercel
value can't split the sites again. The sites are told apart by the `customid` prefix alone, which comes first
in every tag; this site's is `cc-<page>`. The campaign was already 5339155912 here; the override variable is gone.
Replaced: 5339155911 (WargameCompare, FigureCompare, Compare Empire, K Young), 5339231473 (Lorcana),
5339231474 (Gundam), 5339234013 (YGO). Old secrets/variables (`EBAY_AFFILIATE_CAMPAIGN`,
`NEXT_PUBLIC_EBAY_CAMPAIGN_ID`, `EBAY_CAMPAIGN_ID`) are no longer read and can be deleted.

## A modern look, after Compare Empire's — 2026-10-30

**Decided (owner, 2026-10-30: "the cam compare theme is garbage, make it more modern, similar to
compareempire").** Replaces "Plain and clean" (2026-10-17) as the site's look; the motion from
2026-10-18 stays. CamCompare keeps its own identity (the iris logo, brand blue, green for money) but
borrows Compare Empire's design language:

- **Type.** Inter for text and Bricolage Grotesque for every h1–h3, `font-display` and the big
  figures, both self-hosted from `src/app/fonts/` (OFL, the same files as Compare Empire), so a build
  never waits on Google Fonts.
- **Surfaces.** A cool off-white page, white cards with an 18 px radius and a soft shadow
  (`--shadow-card`), rounder buttons, inputs and chips (the Tailwind `md`/`lg`/`xl` radii grew to
  8/12/14 px, so every existing component followed without edits), product photos on a soft white tile
  (`.img-tile`).
- **Header.** Two rows: the tools (Deals, Finder, Compare, Guides, More) beside the logo, and a strip
  of what we sell (Cameras, Lenses, Drones, Smart glasses, Digicams, Used, Accessories, Brands, Just
  announced) under it, which scrolls sideways on a phone, with the tools leading it there. Pills, not
  underlines, mark the current page. The More menu keeps only what the strip leaves out.
- **Home hero.** Centred, on a soft brand-blue glow (`.hero-wash`, CSS gradients only, no image), a
  live "prices checked" pill, the headline with its second half in the brand gradient, the store and
  product counts, a large search box and a tile per department with a photo of a known model, how
  many we list and today's lowest in-stock price. A department with nothing published (drones and
  glasses before their photos arrive) shows no tile. Tile photos prefer our own thumbnails over a
  store's hotlinked one.
- Unchanged on purpose: everything is still in the server HTML, pages stay static, no new request,
  script or image weight beyond the two font files; the pinned Amazon and eBay rows keep their
  colours and "Ad" label.

## 2026-10-30: eBay pinned first, Amazon second

Owner, asking for K Young's quick view on every site: eBay first and Amazon second in the price rows. CamCompare
already had a quick view on every product card (`QuickView.tsx`, the same capture-phase `a[data-qv]` design K Young
uses), so only the order of the two pinned rows changes, on product pages (`OffersTable.tsx`) and in the quick view
alike: eBay, then Amazon, then the store rows in price order.

## Contact page, footer address, feedback emailed to the inbox — 2026-10-30

The owner: "make sure that contact information is really clear on all of our websites so that any feedback feeds
into the respective emails". CamCompare had no `/contact` page, its footer showed no address, and the feedback form
only wrote the private `feedback` table, which nobody is notified about. Now:

- `/contact` gives camcompareapp@gmail.com (`CONTACT_EMAIL`) with subject-filled mailto links; it is in the sitemap.
- The footer shows "Contact us" and the address under the logo, and links `/contact` in the About column.
- `/api/feedback` emails each saved message to `CONTACT_EMAIL` through the community's bounded notifier
  (`notifyOwnerBounded("feedback", …)`, at most 25 a day), with Reply-To the visitor's address when given. Without
  `RESEND_API_KEY` it does nothing; the row is saved first either way.

## eBay keyset live: hot products first — 2026-10-30

The owner got the new eBay keyset ("API4"-named app, 5,000 Browse calls a day) and split it 2,500 to CamCompare and
2,500 to K Young, asking that front-page, popular and recent products get eBay prices first. Each run's eBay budget
is now `ebayQueue` (`src/lib/sources/ebay.ts`): 60% rotates through the hot list (the viral list in
`data/viral.json`, then anything announced in the last two years, newest first), the rest rotates through
everything else, and budget the hot list doesn't need goes to the rest. The hot list is searched several times a
day; the whole catalogue still comes round in about two days.

The 2,500 is split over the eight scheduled runs plus one spare (69 searches per market per run then; since 2026-11-01 the US takes 40%, see "The US comes first in the eBay budget"), so a manual
dispatch never takes the day past the share; `EBAY_DAILY_CAP` can only lower it. The keys are GitHub Actions secrets
only. The app's one Marketplace Account Deletion endpoint is K Young's (`kaeyoung.com/api/ebay/marketplace-deletion`):
CamCompare stores no eBay user data and has no endpoint of its own.

## 2026-10-31 — Quick view motion from K Young

Owner, 2026-10-31, on K Young's quick view: "especially on mobile phone it's so smooth". CamCompare's quick view already
had K Young's shape (a bottom sheet on phones), but its `qv-panel` / `qv-backdrop` classes had no CSS, so it appeared
with no motion. `globals.css` now gives them K Young's 0.18 s rise and fade (none under reduced motion), and a mouse
resting on a card preloads its file (`pointerover`), as on K Young.

## 2026-10-31: wrong-price reports and store suggestions go to a private GitHub repo

**Owner:** "for all of these websites … we must have the ability to report any prices that are wrong, for users to
suggest a store … it's just stored within the GitHub … a daily job that checks for that."

* Every Compare Empire site now has the same two forms: **Report a wrong price** (a quiet link under the price table
  that opens in place, never a pop-up) and **Suggest a store**. Both POST to `/api/report`
  (`src/lib/reports-github.ts`, `src/components/ReportForms.tsx`: the same two files in every site repo).
* They are filed in ONE **private** repository, `Specifxx/compare-reports`: one new JSON file per report at
  `inbox/<site>/<day>/…json`, created through GitHub's contents API with `REPORTS_GITHUB_TOKEN` (a fine-grained token
  with Contents read/write on that repo only, Vercel only). Private because the site repos are public and a note is a
  stranger's free text; the K Young reviews branch is public because reviews are meant to be read.
* Nothing about the visitor is stored: no email field, no IP, no hash of one (the per-visitor limit, 6 an hour, lives
  in the function's memory), and email addresses, IP addresses and phone-like numbers in a note are blanked before
  the write. A honeypot field swallows bots.
* Each write creates a new file (no read, no sha), so reports never race, and the commit subject never carries
  `[deploy]`/`[preview]`. The route is POST only: no page view or crawler runs it, so it costs nothing at rest.
* A daily job in that repo (`triage.yml`) keeps one issue per site listing what is still open, flags repeat
  reports of the same product and store, and warns before the token expires. A handled report is moved to
  `done/<site>/`. Until the token is set the route answers 503 and the form says to email the site's address.
* CamCompare only: `/api/report` also saves each report to the private `feedback` table (kind `price`, or `other`
  for a store suggestion, no email) and emails it to CONTACT_EMAIL under the feedback cap, so the admin page and
  the inbox see them as before; a report counts as delivered if either the table or GitHub took it.

## Visitor reports live on each site's own `reports` branch, not a private repo — 2026-10-31

**Owner:** "we don't need a private repo for this … just build it into each site … inside the public GitHub, it's
fine. As long as it's not reflected on the front end." This replaces the private `Specifxx/compare-reports` repo
of the entry before it; everything else in that entry (the forms, no email/IP, redaction, new file per report,
POST only, 503 until the token is set) still holds.

* Each site writes its reports to **its own repo**, on an orphan branch named `reports` (`SITE_REPOS` in
  `src/lib/reports-github.ts`): `inbox/<site>/<day>/…json`, moved to `done/<site>/…` once handled. The branch is
  never merged into `main` and never deploys: `git.deploymentEnabled.reports = false` in `main`'s `vercel.json`
  (pinned by `tests/reports-github.test.ts`) and the branch's own `vercel.json` turns deploys off as well.
* Nothing on any site reads the branch, so no report ever shows on a page. The branch is public with the source,
  which is why nothing about the visitor is stored and notes are redacted before the write.
* One token, `REPORTS_GITHUB_TOKEN` (fine-grained, Contents read/write on the twelve site repos only), set in each
  Vercel project for Production.
* The daily triage moved to RiftCompare (`Specifxx/TCGEmpire`): `.github/workflows/reports-triage.yml` reads all
  twelve `reports` branches through the API and keeps one issue per site there, plus a once-a-day "Reports digest"
  comment. Those issues are public, so they link to each report's file and never quote a note. It fails (and
  GitHub emails the owner) when a site has no `reports` branch, or the token stops working or expires within 14
  days (checked only when the token is also a TCGEmpire Actions secret). The ops monitor's job list watches it.

## 2026-10-31 — Every product link opens the quick view

Owner, 2026-10-31: "Whenever I click on any item … I want a quick view open like K Young." Cards carried `data-qv`
(`quickViewAttrs`); the quick view now also opens for any other plain click on a link to `[/<market>]/cameras|lenses/<slug>`
(category tables, guides, lists), with the market from the path (`marketFromPath`). Links inside the quick view and on
the product's own page, and modified, middle and new-tab clicks, navigate as before.

## eBay offers carry their postage; the More menu closes on a tap (2026-10-31)

A WargameCompare visitor's feedback (the owner passed it on for every sister site): eBay rows from overseas sellers,
and prices without their postage, made "a lot of wasted clicks". CamCompare's search already asked for local sellers
(`itemLocationCountry`). It now also sends the buyer's country and a central postcode as `contextualLocation` so eBay
quotes real postage, drops a listing whose postage eBay does not state (`statedPostage`), and prices each eBay offer
delivered (item + postage, "Price includes postage" / "Free postage" under the row), so it sorts honestly against the
stores. The same feedback found WargameCompare's phone menu staying open after a tap; CamCompare's More menu closed on
a route change but not on a tap of the page it was already on, so each link now closes it too.

## Christmas theme: 1 November to Boxing Day (2026-11-01)

Owner, 2026-11-01: every Compare site gets a Christmas theme after the Halloween one, each its own take. Snow behind the home hero, corner trees and gifts, a Santa hat on the logo, and a "Holiday camera deals" pill to the market's real price drops. Pages stay static; the boot script decides whether the markup shows.

The season window is fixed in `src/lib/season.ts`: 1 November to 26 December, every year, by the visitor's own
date, stamped on `<html data-season>` by an inline boot script before first paint. `?season=christmas` previews it out
of season and `?season=off` hides it in season. Every decoration is CSS-gated on that attribute, `aria-hidden`,
`pointer-events: none`, painted under the content (never over a price or a button), animated with `transform`
only, and stopped under `prefers-reduced-motion`. The page's content and links stay in the server HTML; the season
adds no request, no script beyond the boot line and no database or data read. The shared rules sit between
`xmas-common:start` and `xmas-common:end` in `globals.css` (identical on every sister site); this site's colours sit in
the `xmas-site` block after it. Art is eight small SVGs in `public/xmas/`. To end it early, move the `to` date; after
Boxing Day it switches itself off.

## 2026-11-01 — Titles say "price comparison" and today's price

Search Console (90 days to 29 Oct): accessory pages rank on page one for "tripod price comparison" (6.1), "tripod price",
"gimbal deals", "memory card price" (SG and UK pages, positions 6–15) with no clicks, under titles like "Tripods: compare
prices and brands (SG prices)". Product pages sit at 8–15 for "<model> price" with no clicks. Accessory category titles now
lead with "<thing> price comparison <market>: N <things>" (no "from" price: the cheapest listing in a category is often a
mini tripod or a spare part), and camera and lens titles carry today's lowest new price when it fits in 60 characters
("Tamron 16-50mm F2.8 A price from $529 & specs"), from the same headline rule as the page (`priceTitle`,
`lib/price-rules.ts`; Amazon prices never, as everywhere in metadata). Falls back to "<name> price & specs".

## 2026-11-01 — Visitors land on their own market's pages

Owner, 2026-11-01: "the default region is the region that the visitor is located in. And if they can't determine it,
then the default should be the US." The US was already the root, but a visitor who arrived on another market's page
stayed there behind a "Shopping from …?" bar. `MARKET_BOOT_SCRIPT` (`lib/market-boot.ts` over `lib/region-boot.ts`,
inline in the root layout, before paint) now moves a person, never a crawler, link preview or audit tool, from a market
page to the same page in their market, through the page's own hreflang alternate (EU by its en-IE entry; a page with no
copy there, such as a market page that is noindex until priced, stays). Their market is the one they picked
(`cc_market`), else their time zone's (Australia/*, Europe/London, Asia/Singapore, any other Europe/* → EU), else the
US. Global pages never move. `<main>` is hidden for at most 1.5 s. GeoSuggest stays for the rest (IP disagreeing with
the time zone, global pages). Pages stay static and the same for everyone.

## 2026-11-01: eBay and Amazon rows look like the other price rows

The owner: "the ebay and amazon links should blend in and look exactly the same as the other price rows … reflect that
change on the other sites that require it." Paid marketplace rows (eBay, Amazon, and TCGplayer where it is pinned) keep
their place and their "Ad"/paid-link label, but lose their brand tints and brand-coloured buttons: they use the same row
and the same button as a store. They are still never counted as a store and never re-ranked by commission. This
reverses the 2026-10-30 "bright, catchy colour" pinned rows; eBay ad strips and panels outside the price rows keep
their own look.

## 2026-11-01 — The US comes first in the eBay budget

Owner, 2026-11-01: "the eBay API for all websites should also prioritise the US." Each three-hourly run used to give
every eBay market the same calls (69 a market). `ebayRunBudget` now gives the US `US_EBAY_SHARE` (40%, 111 a run) and
splits the rest evenly between the UK, EU and Australia (55 each), so a US product's eBay price is refreshed about twice
as often as elsewhere. The day's total is unchanged (2,500, `EBAY_DAILY_CAP` can only lower it) and a manual run still
fits. Inside each market the hot-first rotation (`ebayQueue`) is unchanged.

## 2026-11-02 — Black Friday page

`/black-friday` and `/<market>/black-friday` show the market's deals page (`DealsView`) under a Black Friday heading
with the year's dates, at one URL kept every year so links and rankings carry over. It has to be indexed weeks before
the day (27 November 2026), so it ships now. Same index rule as `/deals` (`dealsIndexable`), linked from the footer and
the sitemap. Never a "was" price of our own, a countdown, "ends soon" or an invented sale. Dates are pure
(`src/lib/black-friday.ts`, tested). Part of the passive-growth plan (owner, 2026-11-02: no daily Reddit posts).

## 2026-11-02 — Free link badges

`/widgets` gives reviewers, photo clubs and stores plain-HTML link badges (a camera, every camera or lens, "our prices
are compared here") that the daily outreach offers instead of asking for a link (passive-growth plan, owner
2026-11-02). No live price iframe like the card sites': it would be a request-time read of public data, which this site
doesn't do. Each badge is one `<a>` with inline CSS (`src/lib/link-badges.ts`, tested). US paths; the page says how to
point one at another market.
