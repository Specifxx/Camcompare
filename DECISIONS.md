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

## 2026-11-02 — Self-updating price report

`/price-report` is one static page, kept at one URL and rebuilt with every price commit: per market, for cameras and
for lenses, how many stores sell new, the median gap between the cheapest and dearest new price, and how much the
cheapest used or refurbished price saves under the cheapest new one. It is the citable asset the daily outreach offers
camera writers (passive-growth plan, owner 2026-11-02), with a quote line. Pure numbers in `src/lib/price-report.ts`
(tested); bodies and lenses only, never kits or Amazon, like every "lowest" on the site.

## 2026-11-02 — Seasonal sale pages

`/boxing-day`, `/january-sales` and `/lunar-new-year` (and `/<market>/…`; owner-approved growth plan,
2026-11-02): one URL per market, kept every year like `/black-friday`, built weeks ahead so they are indexed
before the day. They are the market's deals page under that event's heading (`DealsView` with `sale`), as
`/black-friday` is, static like every page, noindex where the deals page is. The intro states where the day
is a sale day as a fact, never as the page's market. Dates, the year a page is about (it rolls over a week
after the event) and the intro are pure in `src/lib/sale-seasons.ts` (`tests/sale-seasons.test.ts`); Lunar
New Year is a published-date table to 2040 (6 February 2027). Footer and sitemap. Never a "was" price, a
countdown or an invented sale.

## 2026-11-02 — Share buttons and shared saved lists

Word of mouth (owner, 2026-11-02). Every camera and lens page and the quick view have a Share button: the phone's
own share sheet (Web Share API), else copy the link. No pop-up, no reward. The message names the real gap in the
visitor's market (cheapest and dearest new, in-stock, body-only price from two different stores, never Amazon or a
kit, never converted), built at build time (`src/lib/share-texts.ts`); the button only picks the market's line. The
saved list can be shared too: `/saved?i=c:<slug>.l:<slug>` carries up to 50 items in the link, nothing is stored,
the shared view is read-only with each item's cheapest store, noindex, and "Keep this list" copies it into the
visitor's own. Every shared link carries `utm_source=share&utm_medium=<product|list|page>` (`src/lib/share-link.ts`,
client-safe, tested); the button sends a Vercel `share` event and `ShareArrival` one `share_visit` per tab, which
RiftCompare's weekly growth report counts. No new function and no per-product share image: pages stay static, the
product photo stays the preview.

## Sites that grow each other: the family feed, cluster blocks and short footers (2026-11-02)

Owner, 2026-11-02: "We need each site to help each other grow as a team effort", and the
footer family lists were "a bit convoluted … I'm wondering if it actually helps". Plan:
"Sites that grow each other" in the consolidation doc (https://claude.ai/artifact/QjrWGrfBqH4sKctwdjwptK).

- **Three clusters** (`src/lib/family-network.ts`, the same file in every repo): card games
  (Rift, OP, Dex, MTG, Gundam, Lorcana, YGO, Cyberpunk), hobby (Wargame, Figure, Gunpla on
  Gundam Compare) and tech (Compare Empire, CamCompare). KaeYoung stays out.
- **The family feed.** Each site's own daily data job writes `family-feed.json` (its best real
  deals and pre-orders today, per region) beside the data it already commits, and copies its
  cluster sisters' feeds from raw.githubusercontent.com into `family-cluster.json`. Pages read
  the committed file: no database of another site, no request-time fetch, no new function. A
  feed older than four days, from the wrong site, with a link off its own host or a saving that
  isn't the arithmetic of its two prices is dropped (`validFeed`), so a block shows less, never a guess.
- **One block per page**, on the deals, Black Friday and pre-order pages: one tile per sister with
  its best item in the visitor's region, else the US price in its own currency. Labels never name
  a country. Plain followed links inside a cluster.
- **Footers: one short line.** The sites of our own cluster by name, then one "A Compare Empire
  site" link to https://compareempire.com/network, which lists every site. Why: nothing counts
  footer clicks, footer links get few, and Google gives little weight to sitewide links between
  one owner's look-alike sites (12 sites all cross-linked in every footer is the pattern it can
  read as a link scheme). Cross-traffic should come from the price blocks, which people have a
  reason to click.
- **Here:** the deals and Black Friday pages show Compare Empire's three best deals for the market
  (its cameras first); a camera's page links the same model on Compare Empire when `sameProduct`
  finds exactly one; our feed carries every camera's name and aliases so Compare Empire links back.
  eBay rows never become a feed deal (stores only).

## 2026-11-02 — Amazon Associates: following the Operating Agreement's Dos and Don'ts

The owner sent Amazon's own "Operating Agreement: Top Dos and Don'ts" page (2026-11-02: "make sure you
are following these instructions for all amazon affiliates"), and every site was audited against it.
The rules we keep, on every Compare Empire site:

- **Disclosure beside every Amazon link** ("Ad" / "Paid link"), and Amazon's statement "As an Amazon
  Associate I (we) earn from qualifying purchases." in the footer of every page.
- **Amazon's trademark notice** in the footer of every page: "Amazon and the Amazon logo are trademarks
  of Amazon.com, Inc. or its affiliates." No Amazon logo, screenshot, review or Amazon's own colours
  (its orange): the page "Don't use style or color of Amazon site which may cause confusion".
- **Links lead to a specific product** (an ASIN, or a search for that exact product's name), never a
  category or generic search: "All the links or buttons on your site should take customers to specific
  products on Amazon."
- **No Amazon link in a pop-up or layer**: the quick views show none; product pages carry the row.
- **Never Amazon prices in price tracking or alerts** ("Don't track prices or set price alerts"), and no
  Amazon link or trademark in any email, SMS or printed material.
- Every link tagged, rel="sponsored nofollow"; no incentive (cashback, discount) for buying through it.
- Here: the quick view pins only eBay; `.btn-amazon` is the site's own buy colour, not Amazon's orange;
  the footer carries the trademark line. Amazon prices already stayed out of history, alerts and deals.

## 2026-11-02 — The market chooser in the home hero, with drawn flags

Owner: "the region switcher must be more prevalent on all sites, on the main home page hero etc … and have
the flags as well". Every market's home has a "Prices for" row of flag chips above its search
(`MarketChips`: plain links to each market's home, the pick remembered with `rememberMarket`), and the
header's switcher shows the market's flag and code with the native select laid invisibly over them.

- **Flags are inline SVG (`src/components/Flag.tsx`), not the `MARKETS[].flag` emoji and not image files.**
  Windows draws a flag emoji as two letters ("AU"); image files would be new requests and hosting (the
  static-site rule). The footer, the geo suggestion, the releases view and the world prices panel draw it
  too; `MARKETS[].flag` stays for plain-text uses (select options, admin). The same file is in every
  Compare Empire repo that has a region switcher; keep the copies identical.

## 2026-11-02 — Comparison pages answer "which should you buy?"

Search Console (25–31 Oct): 23.9K impressions at position 27 for broad brand queries ("nikon", "fujifilm"), while
the clicks came from long-tail pairs ("nikon z50ii vs canon r10"). The pair pages were a table under a title.

- `src/lib/pair-verdict.ts` writes a short verdict from the spec rows one side clearly wins (compareRows), never
  a guess, and no price: the page's prices follow the visitor's market and this text does not.
- Each pair page links every other indexed comparison of either product ("More comparisons"), so the vs pages
  reach one another, not only through the sitemap. One-sided pairs stay noindex and unlinked from there.


## 2026-11-02: Nobody is moved to another region on a guess

Since 2026-11-01 `lib/region-boot.ts` moved every visitor on another region's page to their time zone's copy in the
browser. Crawlers were excluded, but Search Console then read regional copies as duplicates on Compare Empire, which has
the same script, and Google's guidance is not to redirect automatically on a guessed location. Now only a visitor who
PICKED a region (any `[data-region-pick]` link, kept in localStorage) is moved; everyone else stays on the URL they opened
and gets one line at the top, "This page shows <X> prices. Switch to <Y> prices · Stay", linking the page's own hreflang
alternate ("Stay" remembers the page's region). Crawlers never see the line. The script is byte-identical on MTG Compare,
DexCompare, WargameCompare and CamCompare.

## 2026-11-02 — At most one production build every 12 hours, and no branch but production deploys

**Why.** The owner capped Vercel spend at $5–6 a day across every site. 1 November cost $11.82 (normally
$2–4), and Build CPU was the largest line ($4.26), followed by CDN requests and ISR writes, which every
build multiplies (a deploy empties the page cache, so the next crawl re-renders and re-writes every page).
The `[deploy]` gate itself held; its premise did not: sessions landed 7–14 `[deploy]` commits a day per site
(manual "release now" runs and `[deploy]` in merge subjects), RiftCompare, OP, MTG and DexCompare alike.
Compare Empire's site built on every push to its production branch (84 commits that day) and CamCompare on
every three-hourly price commit, because neither had the gate.

**What.**
- `scripts/vercel-ignore-build.sh` skips a production `[deploy]` commit when the last production
  deployment (`VERCEL_GIT_PREVIOUS_SHA`, set by Vercel in that step) is under 12 hours old; the commit
  rides the next release. `[urgent]` in the SUBJECT overrides it, and only when the owner says a release
  cannot wait. An unset or unreadable last deployment builds (fail open). `tests/deploy-gap.test.ts` pins it,
  and the file is the same in every Compare Empire repo.
- `vercel.json` `git.deploymentEnabled` starts with `"**": false` and enables only the production branch
  (Vercel: when a branch matches several rules, any `true` wins). No preview is built for any branch or pull
  request, `[preview]` included; the older per-branch `false` entries stay for orphan commits' own copies.
- So "push to prod" means land on the production branch; the release reaches visitors within a day.

## 2026-11-03 — Footers link only card sites to card sites; every other site lists no sisters

The owner asked whether linking every Compare Empire site together helps or is a risk for search and for how the
sites look. Verdict: a sitewide footer link between sites one person owns carries little ranking value (Google
discounts it), and a mesh of unrelated sites (camera, appliance and figure sites in a card site's footer) can read
as a link network and looks odd to a reader. The owner said do it.

- `footerSisters()` in `lib/family-network.ts` (same file in every repo) now returns the other card sites for a card
  site and nothing for any other site. Gundam's Gunpla side no longer pulls WargameCompare and FigureCompare into its
  footer; the engine footer's heading is "Other card games".
- WargameCompare, FigureCompare, CamCompare and Compare Empire show no sister list in their footers, only one
  "A Compare Empire site" link to compareempire.com/network (Compare Empire: its own /network), the one page that
  lists every site. KaeYoung still links none.
- Anchors stay the brand name only, and links stay plain followed links: they are honest links between sites with
  one owner, not paid, so no `sponsored`/`nofollow`.
- Kept: the "Other card games" / hobby / tech price blocks on deals, Black Friday and pre-order pages
  (`clusterSisters`). They sit on a few pages, show real prices a reader of that page may want, and are not sitewide.

## 2026-11-03 SEO audit: alt text, homepage schema and FAQ, breadcrumbs on hubs

Bill's network SEO audit read CamCompare's homepage as having no JSON-LD, 61 of 61 photos without alt text and the
description "deals in United States". Every product photo (`ProductThumb`, search, picker, gallery, guide thumbnails,
saved and My gear lists, stories, release videos) now carries the product's name or the story's title. The homepage of
each market carries Organization + WebSite + a printed four-question FAQ (FAQPage), and its description uses the market's
"in the US" phrase. Brand, mount and accessory pages show a breadcrumb with a matching BreadcrumbList, like camera, lens,
pair and guide pages already did. Product + AggregateOffer on camera and lens pages, hreflang (32 on the homepage) and
llms.txt were already in place. `tests/seo-audit.test.ts`.

## 2026-11-03: Amazon AU reads the AU account's own Creators API key

The owner's Amazon Associates AU account (tag `compareempire-22`) was approved. Its Creators API credential is
shared with Compare Empire, so Amazon AU first reads `AMAZON_CREATORS_AU_CLIENT_ID` / `_CLIENT_SECRET` (GitHub
secrets for ASIN discovery, Vercel for the build's price fetch), then the older `AMAZON_CREATORS_FE_*`.
`AMAZON_CREATORS_<AU|NA|EU|FE>_VERSION` (3.1, 3.2 or 3.3, printed beside the credential) picks the token
endpoint, because it follows the store that issued the credential, not the marketplace called. GetItems
answers `itemResults` in Amazon's published sample, so both that and the earlier `itemsResult` are read.
Both sites call the API from the same account (1 request a second, 8,640 a day at first).
## Rate CamCompare and "What people say", run by RiftCompare (2026-11-03)

The owner wanted RiftCompare's rating pop-up on every site, each site's reviews public, and every written review approved in
RiftCompare's admin; star ratings count at once. This is the site's own star rating, separate from the community's product
reviews and from the feedback form (which keeps its own table and inbox). Nothing new is stored here and no page gains a server
read: the corner card (`components/site-reviews/RateCard.tsx`, in the root layout) posts cross-origin to
`https://riftcompare.com/api/site-reviews`, and the homepage's "What people say" reads the score and approved reviews from
`https://riftcompare.com/api/site-reviews/cam` in the browser (public JSON, CDN six hours). The card is RiftCompare's corner
card, not its rating drive: never on arrival, after 4 pages and 3 minutes or on return from a store tab, at most three times 14
days apart, always closable, on the right so it never covers the Feedback button; "Rate CamCompare" in the footer opens it.
While no ad script is on the page it says "We don't run banner ads, so if this helped, please leave us a review." No email
asked for, never review markup. RiftCompare's DECISIONS.md, "Every site's reviews, approved in one queue".

## 2026-11-03: A Creators page and a homepage bubble, like RiftCompare's

Owner: "having the creators page for all of these sites as well is really, really good. Like just a bubble and then a
really nice formatted creators page, just like how RiftCompare does it." Word of mouth from creators and visitors is the
sites' main growth channel, so every site gets one.

`/creators` is RiftCompare's page in CamCompare's theme, without the parts that need a database: the list is the static
array in `src/lib/creators.ts` (empty until the first creator agrees; the grid shows "Your channel here" spots, never an
invented creator), applying is a pre-filled email to `CONTACT_EMAIL`, and there are no creator codes. "Buy them a
coffee" is the creator's own Ko-fi, Patreon or tip page: the site never handles the money. `CreatorsCornerBadge` is the
bubble in the homepage hero of every market (top-right from sm, a centred pill above the headline on a phone); the
header's "More" menu, the footer and the sitemap link the page. Static like every page: no data or request read, no
`revalidate`. Not called "partners" anywhere: that word means the affiliate links.

## 2026-11-04 — Big-store gap: five Shopify camera stores, and why the rest can't be read

The owner asked for every big store captured with no gaps, on every site. Research per market named 87 camera retailers not
in `retailers.ts`; a platform sniff on a GitHub runner (the sandbox cannot reach stores) checked each one's homepage,
robots.txt, `products.json`, the WooCommerce Store API and one JSON-LD product page. Five run Shopify with the feed
allowed by robots.txt and are added as `shop()` dealers: **Glazer's Camera** and **Ritz Camera** (US), **Cambrian
Photography** and **HDEW Cameras** (UK; HDEW is a grey importer and the docs say so), **Kamera Express** (NL, EUR; its
homepage is behind a bot wall but the feed answers and robots.txt allows it). No affiliate programme for any of them, so
they are plain links. Everything else is a bot wall, a Magento or custom storefront with no feed and no usable JSON-LD, a
WooCommerce store (no reader here, and the two found sell accessories or used stock), or unreachable from the runner; the
list per reason is in `docs/retailers.md` ("Big-store gap research, 2026-11-04"). The most-wanted names that stay out
(Samy's, Hunt's, Roberts, CameraNU, Foto Koch, CVP, Wilkinson, Kogan, Ryda) all sit behind bot walls, which are never
worked around.

## 2026-11-04 — List your store: stores come to us

The owner stopped cold email outreach ("not really doing anything") and set the aim: be popular enough that stores
ask us, and encourage the ones that do. Every Compare Empire site now has `/list-your-store` (shared
`ListYourStore.tsx` + the `ListStore` form in `ReportForms.tsx`), linked from the footer, `/contact` and the stores
page: what a store gets (free, no contract, never pays to rank), what we need (a readable shop, own currency,
established), and what happens next (checked within a few days, reply through the store's own contact details).
The request is filed as a `suggest-store` report with `issue: "owner"`; RiftCompare's daily reports triage puts
those first and asks for a reply within two days. No email is asked for (the reports branch is public); no pop-up,
no cold email. RiftCompare and OP Compare keep their `/stores/suggest` page (now the owner pitch) and redirect
`/list-your-store` to it.

## 2026-11-04 — Kamera Express: name the currency, since its /meta.json is bot-walled

The first two price refreshes after adding Kamera Express failed their final source check: `no store currency in
/meta.json`. The store's homepage sits behind a bot wall (noted when it was added) and so does `/meta.json`, which the
Shopify reader asks for the store's currency; `products.json` is the only thing it answers. The reader already has the
answer for that case, `currency` in the store's config (Challenger, Canon Store and Sony Store in Singapore use it), so
Kamera Express now says EUR; a `/meta.json` that answers with another currency would still refuse the store. The prices
themselves never stopped: every market's import and the data commit succeeded in both runs, only the check at the end
was red, as the health monitor reported.

**Then disabled (2026-11-05).** With the currency named, the next run got past `/meta.json` and the bot wall answered
`products.json` page 1, then 403 on page 2. A 403 stops a shop and is never worked around (CLAUDE.md), so the store is
`disabled` with that reason, like Moment: it stays in the registry as a known store, prices nothing and is listed as
"skip", not "FAIL", by the source check. The 2026-11-04 sniff saw only the first page answer, which is why it looked
readable. If it ever gets a feed or an affiliate programme, re-enable it.


## 2026-11-06 — Awin: a retailer that accepts us pays from the next build, with no Vercel step

**Decision (owner: "check if we are making the most of Awin, and if it's not there, just do it"):** the family's Awin
account (Compare Empire, publisher 3144410) is read each morning by Compare Empire's `scripts/awin-sync.ts`, which
publishes the programmes that accepted us, with their tracked domains, in its public `data/awin/programmes.json`. This
site copies it first in every build (`scripts/fetch-awin.ts` → `src/lib/awin-programmes.json`; the committed copy is an
empty list). A retailer with no `AFFILIATE_DEEPLINK_<KEY>` template whose site is a joined advertiser's domain (KEH,
Clifton, Wex, Park Cameras, MPB UK, Calumet, Coolblue…, whichever accept) gets its Awin deep link, and `isPaid` shows
"Paid link". A template, when set, still wins; order and prices never change.

## 2026-11-06 — Store thumbs up and down, one tally shared by every site

**Decision (owner: "a little mini area where you can rate a shop … thumbs up a store or thumbs down a store … across all
the sites you can now see that these stores are trusted"):** every store row carries two tiny thumbs beside the store's
name (`src/components/StoreVote.tsx`, the same file on every Compare Empire site), with counts once a store has votes and
a green "Trusted" mark from 3 thumbs up and 80% of the votes. RiftCompare keeps the votes and serves one public tally
(`riftcompare.com/api/store-votes`, CDN six hours), keyed by the store's host without "www.", so a shop listed on several
sites shares its thumbs; this site stores nothing and fetches the tally in the browser only (no function, no build
step). One vote per browser per store, a few per network, marketplaces (eBay, Amazon, TCGplayer…) get none. Votes never
order prices, hide a store or decide the cheapest. RiftCompare's DECISIONS.md, 2026-11-06, has the rules; change the
component there first and copy it.

## 2026-11-06 — A cart list on every site

**Decision (owner: "I really like the cart feature … all of our websites"; built on RiftCompare first, TCGEmpire
#346):** every store price row gets an "Add to cart" button, and the header a cart with its count on every width.
`/cart` (static, noindexed, out of the sitemap) groups the lines by store with ONE "Check out at <store>" button per
store: Shopify's cart permalink `/cart/<variant>:<qty>,…`, which fills that store's cart and opens its checkout. The
list lives in the visitor's browser only (`localStorage` `ce_cart_v1`): no account, no database, no function. The page
re-checks each line's price and stock from the store's own `/products/<handle>.js` in the browser (Shopify serves it
with CORS open) and leaves a sold-out line out. A line is cartable only when the row's own buy link already is a cart
permalink (the single-click checkout links), so Awin and partner stores, and rows whose variant we don't know, stay
"manual" lines on their own tracked links; eBay, Amazon, TCGplayer and Cardmarket are never lines. Shared files, the
same in every site (port fixes by hand): `src/lib/cart-list.ts`, `src/components/cart/*` (`cart-config.ts` is the
one per-site file; styles imported once from the root layout), `tests/cart-list.test.ts`.

## 2026-11-06 — Every visitor lands on their own region, the US when we can't tell

The owner, for every site: "all of our websites … should default to the US version, unless it detects the user's
country." `lib/region-boot.ts` (byte-identical in MTG Compare, DexCompare, WargameCompare and CamCompare) now moves
every person, never a crawler, on a regional page of another region to the same page in theirs: the region they picked
(localStorage), else their time zone's, else the US. This reverses the 2026-11-02 rule that moved only visitors who had
picked and offered everyone else a "Switch to <X> prices" line; Compare Empire made the same reversal earlier the same
day. Crawlers still see every regional page as it is, and URLs, titles, canonicals and hreflang are unchanged, so
indexing is untouched. A pick always beats the time zone. `tests/market-boot.test.ts` pins it.

## 2026-11-06 — Side rails: eBay left, Amazon right, and the phone dock

Owner: "the eBay and TCGplayer ads, but instead of the TCGplayer ad, we have the Amazon ad banner that's scrollable … and
CamCompare, just like we did for DexCompare and MTG Compare … RiftCompare and the card engine."

- **Rails** (`components/SideRails.tsx`, in the root layout): eBay down the far left, Amazon down the far right, outside the
  page's column, up to ten tiles each that scroll inside the rail. From **1280px** like the sisters: below 1472px `#main` and
  the footer's rows give up 160px a side (globals.css), from 1472px they are their full 72rem and the rails sit just outside.
  The header keeps its full width. Tiles come from one static JSON per market (`/rails/<market>`, force-static,
  `lib/side-rails.ts`), fetched after hydration: nothing in a page's HTML, no function, no SEO change, no AdSense slot moved.
- **eBay tiles**: the import's own eBay Browse offers for the bodies and lenses the most shops list (two bodies, then a
  lens), cheapest new body-only, else used (labelled), with our own product photo. subId `cc-<market>-side-ebay`.
- **Amazon tiles have no price**: the file is served for a day, and Amazon's licence allows a price only 24 hours from its
  fetch with its time shown (the product page's own row does that). Links go to Amazon's page of the item when its ASIN is
  known, else an exact product-name search; ascsubtag `cc-<market>-side-amazon`. No Amazon rail in Singapore (no tag), and
  Singapore has no eBay rail (no eBay offers there).
- **Phone dock** (`components/AdDock.tsx`, from DexCompare / WargameCompare): below 1280px the eBay tiles in a 64px bar at
  the foot of the screen, after 60% of a screen is scrolled, hidden beside the footer, the rating card, any ad unit, a dialog
  or the keyboard, never on a camera or lens page (`data-no-dock`), ✕ for the visit; the feedback button already lifts above
  fixed bars. **Never Amazon** (no Amazon link in an overlay). subId `cc-<market>-dock-ebay`.

Not beside a buy button and not above a price (the Ads rules): the rails sit outside the page's column.
**Measure** with the sisters' ~11-10 / ~11-17 checks. If pages per visit drop on phones, drop the dock first.

## 2026-11-06 — eBay and Amazon rows are full price rows, on top, outlined

**Decision (owner: "eBay prices and Amazon prices should function exactly like a normal store price row. So you can also
add to cart … if it's in stock … it just sits on the very top. And it has a different colored outline"):** the eBay row
is always the first row, with a green outline, and Amazon the second, with an amber one. Both carry everything a store
row has: the stock line, the store thumbs (one tally per eBay / Amazon domain, `ebay.com.au`, `amazon.com`…) and the
cart button. They are "manual" cart lines on their own tagged links (`src/lib/cart-list.ts`), never a Shopify checkout;
an Amazon line's price is dropped from the visitor's list after 24 hours (Amazon's licence), and the cart then says to
see today's price on Amazon. With no Amazon price the row reads "Also check on Amazon", a tagged link. Unchanged: neither
is counted as a store, "Best price", a deal, an alert price or the reference price; TCGplayer and Cardmarket stay
references (no thumbs, no cart line); no Amazon link in a pop-up.
CamCompare: `PinnedMarkets` rows take the stores' own `retailerButtonClass` button (was `btn-buy`), the stock line and the cart line from `ebayPin` / the Amazon pin.

## 2026-11-06: The quick view carries the tagged Amazon link (owner)

Since 2026-11-02 the quick view showed no Amazon link (or, on KaeYoung and ScentCompare, an "Amazon" row that opened our
own product page), read as Amazon's ban on links in pop-ups. The owner noticed the quick view sends nobody to Amazon and
chose (2026-11-06) to put the product page's own tagged Amazon link there. Amazon's Participation Requirements, item
(o): "You will not post or serve any Special Links … within any pop-up or pop-under windows, transitional page ads, or
layer ads, except for pop-up windows in conjunction with your Site promoting Products closely associated with the
materials on your Site." A quick view the visitor opens for one product, showing that same product, fits the exception;
the owner accepted the remaining risk. The quick view shows the link only (the item's own page where the ASIN is known,
else the tagged search), never Amazon's price: that stays on the product page under the 24-hour licence. Uninvited
overlays (a phone ad dock, a corner card, an exit pop-up) still never carry Amazon, and an Amazon page is never framed
(item (n)).

## 2026-11-07 — Product and brand titles say the year, the market and the store count

The owner's Search Console and Bing audit (2026-11-07: 145 clicks from 54.8K impressions, CTR 0.3%) asked for the top
20 pages by impressions to be rewritten. Search Console's 90 days to 2026-11-04 (`sc-domain:camcompare.app`,
TCGEmpire *Maintenance* `gsc-queries`): 15 of the top 20 are camera pages (Canon EOS C500 Mark II 882, Sony FX5 213,
Hasselblad X2D 100C 195, Canon 5D Mark IV/III, Nikon Z6, X100VI, Leica M11, EOS R, G7 X Mark III, Z6 II, GoPro Hero5,
Ricoh GR IV, Nikon ZR, Leica Q3) at positions 8–25 and almost no clicks, then two AU accessory hubs (already retitled
2026-11-01), the Hasselblad and AU GoPro brand pages and two lens pairs (one at 10.8% CTR, left alone). Their queries:
"<model> price", "<model> price 2026", "<model> price usd", "cost of <model>", "sell <model>", "hasselblad camera
price". So (`lib/price-rules.ts`):

- **Titles** `priceTitle`: "Leica M11 price 2026: from $8,995, 4 stores", stepping down to "…price 2026: from $X",
  "…price: from $X", then the old forms. Outside the US the title names its market itself ("Sony FX5 price in
  Australia 2026: from A$7,770", else "…price AU: from …") instead of the "(AU prices)" suffix, which cost the price
  its room. Only used stock: "…price 2026: used from $X". Always within 60 characters with " | CamCompare".
- **Descriptions** `priceDescription`: the price first ("Leica M11 price in the US: new from $8,995 at 4 stores, used
  from $6,495."), then the spec line, then what the page has, each part kept only while it fits 160 characters; a
  product nobody has in stock says so instead of a bare spec line.
- **Brand pages**: "Hasselblad camera prices 2026: N cameras & M lenses compared", stepping down to fit.

URLs, headings and page content are unchanged. Recheck CTR on these pages ~2026-11-25 with the same report.

## 2026-11-07 — Black Friday strip and Cyber Monday page (owner: "capture all of the Black Friday SEO")

Black Friday is 27 November 2026 and Cyber Monday 30 November. Three additions, this site:

- **`/cyber-monday`**, its own URL for its own searches ("camera cyber monday deals"), kept every year like
  `/black-friday`, listing the same real store deals. In the sitemap and footer; the two pages link each other.
- **The holiday strip**: one line under the header on every page, in the server HTML, linking `/black-friday`
  from 1 November to the Saturday after it, then `/cyber-monday` to the day after Cyber Monday, then nothing
  (`saleStrip` in `lib/black-friday.ts`, tested). The same link leads the nav while it shows. A link, never a
  pop-up (pop-up policy: no uninvited interruption on a visit's first page), never a countdown or "ends soon".
- **More on both pages, nothing taken away**: the URL, title and h1 of `/black-friday` are unchanged; below the
  existing deals come four visible questions (the dates, whether stores have sales, shipping, how often it updates). No FAQ rich-result markup:
  Google shows those only for government and health sites since 2023, so the text is what ranks.

## 2026-11-07: A market's product page needs three stores to be indexed

The owner's Search Console and Bing audit (2026-11-07): the same camera exists at five market URLs, and outside the US
most of those pages were one or two stores' rows under the US page's specs, which Google buckets as thin. Since then a
product page outside the US is indexable only with three or more stores listing it there (`src/lib/indexing.ts`,
`MIN_MARKET_STORES`; Amazon is not counted, as its prices are fetched at build and never committed). Below that it is
noindex, follow, out of the sitemap and out of hreflang, and links to it are nofollow; it stays live for a visitor in that
market. The US page is always indexable (it is the catalogue's own page). The product page, hreflang, the sitemap, the
summaries and the related-product links all ask `productIndexable`, so they cannot disagree. Sitemap: 3,960 → 2,616 URLs
(product pages 2,864 → 1,520), which keeps "Every sitemap URL is indexable" in `tests/seo.test.ts` true. Earlier rule
("Market product pages are noindex until priced") is replaced by this one; CLAUDE.md updated.

## Black Friday indexing push (2026-11-07)

Owner: get the Black Friday pages indexed and ranking. Every market's sale pages were already in the sitemap and in the daily
whole-sitemap IndexNow run, but with no lastmod. They now carry the market's last offers import (`offersGeneratedAt`), which
is when they last changed. The Black Friday post (`camera-black-friday-deals-2026`) now links both sale pages, and the
Black Friday and Cyber Monday pages link the post.

## 2026-11-08 — One Our sites page instead of footer cross-links

From the owner's Search Console audit of DexCompare: its only links from other sites were ~9,000 site-wide footer
links from our own sites, all to its home page, with the brand or a keyword as the anchor. They pass no authority,
and a network of same-owner sites linking each other from every page is the pattern Google's link-spam policy warns
about. CamCompare indexes well with more of them, so they are not what holds a site back, but they buy nothing.
DexCompare's footer went first (CompareEmpire #153); every other site now does the same: the footer links one
internal page, `/our-sites`, and that page links each other family site once, by its plain name, from
`FAMILY_SITES` (`lib/family-network.ts`, unchanged; `footerSisters` stays for the shared test). Every other footer
link, page URL and title is unchanged. Cross-traffic still comes from the price blocks on the deals and pre-order pages.

## 2026-11-08 — Christmas is one quiet line, not a costume

Owner: "some of the christmas themes on our websites are a bit too much - the theme must match the domain". The
2026-11-01 Christmas look (falling snow, a strand of lights, trees, presents, candy canes, stockings, a Santa hat on the
logo, candy-cane stripes and seasonal palette swaps) is gone, with its art in `public/xmas/`. The season keeps at most ONE
touch, drawn in the site's own colours: the "Holiday camera deals" line in the hero (`.xmas-pill`), in the site's own colours, with no gift icon. It still starts and ends by itself (`lib/season.ts`, 1 November to
Boxing Day), and the tests pin that nothing else comes back. Black Friday and Cyber Monday (strip, pages, nav) are
unchanged. The same rule went to every sister site: the site's own identity first.

## 2026-11-08 — Store badges, free price data and My collection (competitor scan)

The owner approved the competitor scan's ideas (Collectr and PriceCharting keep people coming back with "what is my
collection worth"; Scryfall grew on free data credited with a link; price sites earn links from the stores they list).
- **Store badge.** `/list-your-store` ends with "Already listed? Add our badge": a plain-HTML (`lib/store-badge.ts`) "prices compared on"
  badge (an ordinary link: no iframe, script, image or tracking) and its code to copy. `ListYourStore.tsx` takes it as the
  optional `badge` prop and stays the same file in every site. Stores see it when they come to us; nobody is emailed about it
  (cold outreach stays stopped).

## 2026-11-08 — Best cameras by use: the finder's rules as static pages

Owner approved the competitor scan's search-by-need hubs (2026-11-08). People search "best camera for vlogging", not a
model. `/cameras-for/<use>` (and `/uk/…`, `/eu/…`, `/au/…`, `/sg/…`) turns the camera finder's seven uses (`lib/finder.ts`
USES: everyday, vlogging, sports, wildlife, landscape, portrait, adventure) into a static page each
(`components/curated/UseView.tsx`): the 12 best-scoring cameras with a price in the market, then up to 6 under 650 g,
every pick showing the spec rules it met. The order is the finder's own score (then current models, then newest);
commission never decides it, and nothing is invented: the rules read the catalog's spec-sheet facts.

- Static at build like every page (no `revalidate`); indexed, and in the sitemap, only with 3+ priced picks in the market
  (owner: 3+); the regional copies are hreflang alternates of each other through `pageMeta`.
- The finder page links all seven.

## 2026-11-08 — "Is this a good price?" link checker

The competitor scan's gap #7, the same checker every Compare Empire site got that day. `/is-this-a-good-price` (one
page for every market: the store's own market decides) takes a pasted camera store link, or one pasted into the header
search, and reads `/check/<host>`: one static file per store host, written at the build from the committed offer files
(`lib/link-check-index.ts`, `force-static`, `dynamicParams = false`). No function, no request-time fetch, and the
store's page is never opened. Like is compared with like: one key per market, product, condition, kit (by its lens)
and lens mount, so a used body never sets a new body's verdict. Amazon (its prices are never committed), eBay and the
link-only marketplaces are never a store here. A link we can't place offers the closest catalogue matches from
`/search-index.json`.

## 2026-11-09 — Navigation audit: one list, seven header items, dropdowns in the HTML

Owner: navigation is very important; a buyer deep in one corner (Sony E, full frame, a 70-200) must reach it fast. The header
had thirteen links on two rows, and "Camera systems" (the way most buyers start: which mount am I on?) sat inside a
click-to-open "More" menu that was not in the server HTML at all.

- **Seven items from lg up:** Cameras, Lenses, Brands and Systems open a dropdown; then Deals, Used and More. Dropdown
  panels are ordinary links in the server HTML (shown by CSS hover and focus, and by the chevron button on touch);
  Escape closes. Cameras: by type, sensor, budget and use. Lenses: by mount, focal length and budget. Brands and Systems
  list every live brand and mount, so each hub is one click from any page.
- **One source** (`lib/nav.ts` constants, `lib/nav-data.ts` built from the catalog once per process): the header, the
  phone menu and the footer read it. Only what is live is linked: a type, sensor, brand, mount or use with nothing behind
  it is left out, the budget tiers are in the market's currency, and `/cameras-for/<use>` is linked only where that market
  has the three priced picks that index it (`lib/uses.ts`, moved out of `UseView.tsx` so node tests can load it).
- **Filter links open the finder** (`/cameras?type=`, `?sensor=`, `?budget=`, `/lenses?mount=`, `?focal=`). The finder's
  canonical stays the bare page, so these add no thin indexed pages. No new URL, title, h1 or JSON-LD.
- **Phones:** under lg a strip of the same sections and a menu button that opens the full list, grouped; search stays in the
  header row. The old "⋯" menu (`MoreMenu.tsx`) is gone.
- **Orientation:** a brand page links its systems (and the finder preset to the brand); a mount page links its lens makers.
  The footer's 40-link column is regrouped (Shop, Learn and join in, About) with the same destinations.
- Not changed, flagged to the owner: the eBay and Amazon side rails and the phone dock (owner-approved 2026-11-06, but they
  float beside the page), and no sidebar (the layout is a single 6xl column by design).

## 2026-11-10: Query URLs are closed to crawlers (SEO indexing plan, SEO-2)

- Every page carried about 34 followed filter links (`/cameras?type=mirrorless`, `/au/cameras?sensor=full-frame`,
  `/lenses?mount=`, `?brand=`, `?budget=`, `?focal=`). Search Console listed them under "Duplicate without user-selected
  canonical" while 619 real pages still waited to be crawled.
- `robots.ts` now disallows `/*?` for `*`, with the sister sites' Allow list (`/_next/`, share images, icons,
  `?utm_source=share`) so Next's assets and link-preview fetchers still work; the longest rule wins. No sitemap URL has a
  query string, and `/compare?c=` is noindex already, so nothing indexable depends on one.
- Every internal link whose href has a query string now carries `rel="nofollow"` (the header dropdowns and phone menu,
  brand, mount, camera, lens and gadget views, accessory counts). The links stay: visitors still reach the finder.
- Pinned by `tests/seo.test.ts`. Titles, URLs, canonicals and the sitemap are unchanged. SEO-9 (real type and sensor hub
  pages, replacing the filter links in the navigation) is the follow-up.

## 2026-11-10: A product page's first phone screen: price, buy button, used, and "Compare with" (site review CAM-3)

Visitors viewed 1.3 pages; the top entries are product pages (G7 X Mark III, GFX100S II, ZV-E10), landed from Google on
a phone. At 400 px the first screen was the photo, then the name: the price and its button started below it, and the one
"Compare with" link sat under the actions. Now, below `md` only, the photo follows the text column (`order-last`), the
h1 is a size smaller, the price panel's "Typically X–Y" line is hidden (it stays from `sm` up), and a new `CompareWith`
row under the price panel links up to three rivals: an indexed pair (each names the other) to its `/compare/<a>-vs-<b>`
page, any other rival to the noindex builder with `rel="nofollow"`, as before. It replaces the single "Compare with"
button. On a 400×780 screen the G7 X Mark III page now shows the best new price, its buy button, the used price and the
three compare links before any scroll. Lens pages get the same, with their key specs after the actions on a phone. No URL,
title, meta, canonical or JSON-LD changed, and no ad sits beside the buy button. Desktop is unchanged.

## 2026-11-10: Striking-distance pass, step one: home-page links to the price-check pages (SEO-6)

**Why.** Week ending 8 Nov: 10,778 impressions at average position 28 for 41 clicks. Search Console query report
(TCGEmpire Maintenance `gsc-queries`, 28 days to 9 Nov), queries at position 4–20 with 40+ impressions, and the page
Google shows. Cam's product pages already answer a price query in their first screens (PriceBox, then the Overview's
price line from `lib/overview.ts`), so the content half of the card was already done; what the ranked pages lacked was
internal links with the query's own wording. Titles are untouched (judged 25 Nov).

| Query (position 9 Nov) | Impressions | Page |
|---|---|---|
| fujifilm (17.1) | 188 | `/brands/fujifilm` |
| leica m11 price (9.2) | 77 | `/cameras/leica-m11` |
| cheap manfrotto 434b aluminium monopod (13.8) | 65 | accessory pages (not changed) |
| fujifilm x100vi price (14.7) | 64 | `/cameras/fujifilm-x100vi` |
| gimbal near me (9.9), gimbal deals (11.8), gimbal for sale (14.6) | 58 / 53 / 40 | `/accessories/gimbals` |
| c500 mark ii price (11.3), canon c500 mark ii price (13.4), buy canon cinema eos c500 ii (19.0), canon eos c500 mark ii price (15.4), eos c500 mark ii price (14.8), cheap canon cinema eos c500 ii (14.6) | 56 / 55 / 52 / 51 / 45 / 40 | `/cameras/canon-eos-c500-mark-ii` |
| leica q3 price (9.4) | 47 | `/cameras/leica-q3` |

**What.** `lib/striking-links.ts` lists ten camera pages (these plus Nikon Z6 II, Z5 II, Panasonic GH7, S9, Hasselblad
X2D II and Nikon ZR, which show at 7–17 for "<name> price"); the home page gets a "Camera prices people look up" strip
of plain followed links ("Leica M11 price" …), plus "Gimbal deals" and "Fujifilm cameras and lenses". A camera's link
shows only where its page in the visitor's market is indexable. No URL, title, canonical or JSON-LD change.
Cannibalisation: none of these queries is shared by two of our pages in the report.

**Recheck 25 Nov:** same ten query groups, same pages, compare position and impressions.

## 2026-11-10: Camera hubs by type and by sensor size (SEO-9)

**Why.** "Mirrorless cameras", "full-frame cameras" and "action cameras" are searches with buyers behind them, but
they existed only as filter states (`/cameras?type=mirrorless`) that Google folds into the one `/cameras` page. SEO-2
closes the filter-link crawl trap (robots `Disallow: /*?`), so the navigation needs real pages to link instead.

**What.** Static pages `/cameras/type/<type>` (mirrorless, dslr, medium-format, rangefinder, action, 360, cinema) and
`/cameras/sensor/<sensor>` (full-frame, aps-c, micro-four-thirds, medium-format), US at the root and each market under
its prefix (`lib/hubs.ts`, `components/curated/HubView.tsx`, same pattern as `/cameras-for/<use>`). Each has its own
title and description ("Mirrorless cameras: N models from $X"), an intro whose numbers come from the day's offers (how
many are priced, how many makers, the cheapest new one, the median), every camera priced in that market cheapest first
with no paid placement, links to the other hubs, BreadcrumbList JSON-LD and hreflang between the markets that list it.
The sensor grouping is the filter's own (`sensorGroup`: Four Thirds counts as Micro Four Thirds, Super 35 as APS-C,
APS-H as full frame), so a hub lists what the filter did.

**Indexing.** A hub is indexed, in the sitemap and in hreflang only where HUB_INDEX_MIN (3) cameras are priced in that
market; otherwise it is noindex,follow, like `/cameras-for`. The header's "Shop by type" and "Shop by sensor" columns now
link the hubs live in the visitor's market (`nav.hubs`, `groupLinks`), in place of the `?type=` and `?sensor=` links;
compacts, drones and glasses keep their own pages. The finder page `/cameras` keeps its filters and its canonical.
`tests/seo.test.ts` pins sitemap membership, metadata and ordering.
## 2026-11-10: Compare pairs from the "vs" searches Google already sends us

Site review task CAM-2. `/compare` pages win 1.9% of their impressions as clicks; product pages 0.2%. We listed every Search
Console query with "vs", "versus" or "or" over 90 days (TCGEmpire `gsc-queries` now prints them all, with the page Google shows
most) and every `/compare` URL with impressions in the `demand` branch. Every compare page with impressions is already an indexed
pair (both products name each other). The searches with no page of their own, and only those, became pairs, each a real cross-shop:
Nikon Z7 vs D850 (the Z7 named the D850, not back), Leica M10 vs M11 (same), and Fujifilm X-E5 vs Ricoh GR IV (neither). Searches
naming brands we don't sell ("nikon vs black diamond") were left alone. Rerun the report monthly; add only pairs a search names.

## 2026-11-10: member thread and story links carry a readable title

URL audit across all 17 sites (owner: "all links meaningful, not a hash"). Every indexed page on every site already
uses a readable slug; the only opaque public addresses were Cam's member `/community/t/<id>` and `/stories/p/<id>`,
which people paste into chats. They are now `/community/t/12-best-travel-lens` and `/stories/p/7-my-first-film-roll`
(`threadPath`, `storyPath`, `titleSlug`, `idFromSegment` in `lib/community/rules.ts`). The id still decides: the rewrites
accept the bare id and any title tail, and the page replaces the address with the canonical one once the title loads,
so old links keep working with no redirect function. Both pages are noindex (a story only when the owner features it),
so no ranking is at stake; a featured story's canonical is now the titled address. Capability links (shared decks,
lists, snapshots, creator edit links) stay opaque on purpose: unguessable, noindex.

## 2026-11-10: The nearest paid price under the hero's best price

The zero-earnings diagnosis (10 Nov) found 197 buy clicks in 30 days, 96 of them to a link that can earn, and nothing
earned. The hero names one offer, the cheapest, which often pays nothing. RiftCompare's paid-alternative rule (owner
2026-10-27) is ported (`lib/paid-alternative.ts`, `PriceBox`): when the hero's offer is not a paid link, a line under its
button names the cheapest paid offer of the SAME kind (new body-only, used body-only, or a kit of the same condition, the
`lib/price-rules.ts` groups), in stock and in the same currency, within 20% of it: "or $7,160 at eBay.com +7% →",
"Paid link". Amazon counts only as the hero does (shown live with its time, `TimedPrice`). It is the offer's real price,
never "Best price", never a reorder. Clicks are `buy_click` placement `hero_alt` (and the sub id). On the day's data (no
Amazon prices locally) it shows on 205 of 2,558 product-market heroes; 708 heroes already lead with a paid offer.

## 2026-11-10: parts, accessory bundles and special editions are no longer a camera's price

The US offers of 10 Nov carried eBay parts as cameras ("Canon PowerShot G7X Mark III LCD Part" at $395 new, "Fujifilm X 100vi
Lens Assembly Part" at $208.98 used, a PolarPro grip set on the X100VI), and bundles and editions filed under the base product
with `kit: false` (Beach Camera's "Body + 128GB Card Bundle", the Osmo Pocket 3 Creator Combo, Insta360 X5 Essentials Bundle,
GR IV 30th Anniversary and Monochrom under the GR IV, Leica Q3 Monochrom under the Q3). Every rule below only refuses or
re-labels, with a real title for each in `tests/matching.test.ts`:

- **Parts** (`PARTS`): "part(s)", "ass'y"/"assy"/"assembly", "PCB", "optical unit", "job lot", for every listing.
- **Accessory makers** (`ACCESSORY_MAKER`: PolarPro, SmallRig, Tilta…) in a camera listing, unless "+", "with" or "&" comes
  first ("X100VI + SmallRig UV Filter" is the camera); a title ending "Accessories" with nothing before it saying "with".
- **Editions** (`otherEdition`): "Monochrom(e)", "Anniversary", "Commemorative" or any "<word> Edition" the catalog
  product's own names don't carry is refused: special and limited editions are other products, priced apart. "Standard
  Edition" is the base product, "Creator Edition" a bundle. The GR IV Monochrome gained the store spelling "GR IV Monochrom".
- **Bundles** (`isBundle`): combo, bundle, package, creator/vlog/starter kits, a card, SSD or reader thrown in, "with 8
  Essential Accessories" make `kit: true` for every camera, body or fixed lens, and "kit" alone does for a fixed-lens one.
  "Body" no longer cancels it. "Standard Combo/Bundle" (the maker's base pack) and a used listing "with accessories" (its own
  box contents) stay the camera. A body bundle with no lens reads "Bundle", not "Kit with a lens" (`kitText`).
- **The import re-reads every offer** (`recheckOffers`, after `mergeOffers`): one the matcher now refuses as a part, an
  accessory or an edition goes, one naming an edition the stored product isn't goes, and a bundle becomes a kit. Rows a
  rotating eBay pass keeps from earlier runs are cleaned without a new search. A title the matcher simply can't read (a
  GTIN match) is kept.
- **Median floor for cameras** (`dropPriceOutliers`): with 3+ in-stock new offers, a new camera offer under 50% of their
  median, or a used/open-box/refurbished one under 25%, is dropped (GO 3S Action Pod, GR IIIx viewfinder, Zeiss ZF lenses
  under the Nikon Zf, used Leicas listed as new). Lenses are left to `plausiblePrice`: white-box and kit-split lenses sell new
  at 45–50% of the boxed median and used kit zooms at 16–35%, so the same floor would drop real prices.

Dry run over the committed offers: 135 rows dropped as parts, accessories or editions and 466 re-labelled as bundles across
the five markets; the median floor drops 19 more, all camera accessories, wrong products or used bodies listed as new.

## 2026-11-12 — Paid rows made visible and clickable (owner: "flood the underperforming sites with affiliate links, highly visible")

The owner asked for the paid rows to be easy to see and click on the two sites that earn almost nothing from heavy traffic (Compare Empire, CamCompare). Changes are presentation only: the eBay and Amazon rows and any paid store row now carry a filled button with its action ("Buy on eBay", "Buy on Amazon", "Buy at store") at every width, including phones, where the button used to be a bare icon; the label reads "Ad · Paid link"; the hero's eBay button is filled; CamCompare's "or $X at <store>" line is a button. Unchanged on purpose: every link is rel sponsored, a paid row is never counted as a store, "cheapest" or a deal, commission never decides the order of the store rows, no pop-ups, URLs, titles and metadata are as before.

## 2026-11-12 — The home deal feed features the dearer half (owner)

A bigger ticket pays a bigger commission, so the home page's deal feed keeps to deals priced at or above the MEDIAN live deal price
of the market (`homeFloor` in `lib/deals-home.ts`; own currency, never converted; on 2026-11-12 data about US$899, £780, €1,449,
A$1,490), and "Hot", the feed's default order, weighs money saved times percentage saved, so a 20% saving on a body outranks 40% on a
cheap lens. A market with fewer than six qualifying deals keeps the whole feed. Cheaper deals are not removed: they stay on
/deals, the product pages and search, and URLs, titles, metadata, JSON-LD, the sitemap and the price order inside a product's
table are unchanged. Nothing ranks by commission.

## 2026-11-12 — A tasteful Christmas layer, more festive than the 8 November pill (owner)

On 2026-11-08 the owner had the first Christmas look stripped ("a bit too much: the theme must match the domain"); on 2026-11-12
he asked for it to be more festive again. The answer is accents, not a costume, the same shape on every Compare site in each
site's own colours. Inside the existing window (`lib/season.ts`, 1 November to 26 December by the visitor's date,
`?season=christmas|off`), the home hero's deals pill becomes a one-line Christmas card (`ChristmasBanner`: inline SVG gift in
`currentColor`, "Christmas camera deals", a short subline from 640px, a pine badge, a cranberry 3px left border; not a heading).
CamCompare has no gift-guide page and none was created, so it links the market's `/deals` page, as the pill did. `globals.css`
adds a 3px two-tone cranberry-then-pine hairline at the very top of the page (a hard-stop gradient on `html::before`, absolutely
positioned, no layout shift) with light and dark tokens (`--xmas-red`, `--xmas-green`), and the pill and the Black Friday strip
take the same tokens for their border only. No new request, script, image or font. Still gone, and pinned in
`tests/season.test.ts`: snow, lights, hats, candy stripes, palette swaps, sparkles, keyframes and canvas. ONE off switch:
`CHRISTMAS_FESTIVE_LAYER` in `lib/season.ts` gates the card's markup (false renders the old pill) and the `data-festive`
attribute every rule keys on; set it false after New Year, or let the window end on 26 December. No URL, title, meta, h1 or h2
changes, and the pages stay static.


## 2026-11-12: the festive layer is released urgently (owner)

The owner said to deploy the festive layer urgently once every site had it, so this merge carries `[deploy] [urgent]` in its subject: one production build now, instead of waiting for the next release. No other change.


## 2026-11-12: a calmer price table (owner)

The owner opened DexCompare and its quick view and said there was too much going on: too many colours, a colour per row. DexCompare's
rule now applies here too: the accent is for the one thing to press, green is for money (the best price), everything else is neutral.
This replaces the coloured outlines of 2026-11-06 and 2026-11-07.

`PIN_OUTLINE` (`OfferRows.tsx`) is empty: the pinned eBay and Amazon rows lose their green and amber outlines, and the "Best price" row keeps only its soft tint and tag.

Order, labels, links, tags, URLs, titles, metadata and headings are unchanged; what we earn still never decides order. Measure outbound
clicks per placement on 19 November against the week before: if the pinned eBay row's clicks fall, strengthen its button before
bringing any outline back.

## 2026-11-12: Amazon's row only with a real price

Owner: "we just want eBay and TCGplayer as the paid links at the top. That is why our revenue is declining." Amazon is pinned only
when its Creators API price is shown; the "Also check on Amazon" pinned row and the quick view's Amazon link are gone.
`tests/paid-rows.test.ts` pins it.

## 2026-11-13: urgent release

Owner asked for every site to be released now: the unpriced-Amazon fix, Fetch as an ordinary store row and the blue TCGplayer button had been merged without a deploy marker. One build, via this commit's subject.

## 2026-11-13: the side rails are off; the ads are the strips inside the page

Owner: visitors looked down, the side banners "don't look as good" and spoil the site's look, so the eBay and TCGplayer (or Amazon) rails come off every site and the page column gets the side space back. The ads that stay are the horizontal strips inside the page and, on small screens, the phone dock (after a scroll, never on a product page). The rail code stays behind one constant (`SIDE_RAILS = false` in the rail component, or `SITE.sideRails` on MotorCompare): nothing is rendered or fetched while it is false, and the CSS that narrowed the column for them is gone. Measured before the change (Vercel Web Analytics, unique visitors, Oct 30 to Nov 5 against Nov 6 to Nov 12, the rails having shipped Nov 6): DexCompare 4,200 to 4,972 with bounce 57% to 43%; RiftCompare 3,399 to 3,179 (its fall was Oct 29, a week before the rails); OP Compare 1,123 to 1,016. The measure to watch next is clicks per placement for the strips, not visitors. Never re-add rails, a floating banner or a gutter ad without the owner.

## 2026-11-13: one native horizontal ad block in place of the side rails (owner)

Owner: the side rails are off (entry above), and wanted the ad space back as ONE bigger, subtler horizontal block inside the page that looks like
the site, not a banner. `components/InlineAds.tsx`: a `card` section of six larger tiles (144px picture, two-line title, price), full column
width, scrolling sideways on a phone, a small muted "Ad" label, the site's own surface, border and text tokens, no colour of its own. eBay's tiles first
(four, or all six where there is no Amazon, i.e. Singapore), then Amazon's two: Amazon tiles carry NO price and link to the product's page by ASIN, else an
exact-name search; Amazon is a labelled paid link and is in no overlay.

- **Same data as the rails**: the static `/rails/<market>` file (`lib/side-rails.ts`), fetched after hydration by `useAdFeed`. Nothing is in the server
  HTML but the section's reserved height (CLS 0); with nothing to show it folds away. New tags: `cc-<market>-inline-ebay` and `…-inline-amazon`
  (the dock rewrites inline-ebay to `dock-ebay`); every link goes through `OutboundLink`, rel sponsored, a `buy_click` event with that placement.
- **Where, once per page**, always through `AdOrPromo`: the home page between the browse section and the reviews; a camera or lens page below all its
  content (never beside a buy button or above a price, never in the quick view); the browse, deals and accessories pages after their lists. `AdOrPromo`
  draws the AdSense slot instead while `NEXT_PUBLIC_ADSENSE_CLIENT` and a slot are set (the AdSlot rules unchanged), else this block. It replaces the
  "Shop on eBay" boxes (`EbayPromo`) and the home page's `EbayStrip`, both deleted, so there is exactly one such block per page.
  `data-ad` makes the phone dock yield to it.
- **Kept**: the phone dock (`PhoneDock.tsx`, eBay only, after a scroll, never on a product page). Deleted: `SideRails.tsx`, the rail CSS and the
  `SIDE_RAILS` switch. `ebay-links.ts` keeps its link builders (viral cameras, My gear). Never a store, best price, deal or alert; rankings unchanged.
- Measure clicks per placement (`inline-ebay`, `inline-amazon`, `dock-ebay`) against the boxes of the week before. No pop-up, no fixed or floating
  banner and no gutter ad without the owner.
