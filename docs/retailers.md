# Retailers, prices and affiliate links

Every retailer, per market, with:

- where its prices come from;
- which affiliate programme pays for its links;
- the variable that switches each on.

The tables below are generated from `src/lib/retailers.ts` by
`npx tsx scripts/gen-retailer-docs.ts`. ★ means the retailer gets a "Check
price" row on every product page where we have no price from it.

## How prices get in (legitimately)

| Source | What it needs | Where it runs |
|---|---|---|
| Amazon Creators API | Associates account per marketplace plus Creators API credentials. Amazon opens the API only after 10 qualifying sales in 30 days. Until then Amazon gets "Check price on Amazon" rows, because its prices may only be shown from its API. The daily import finds ASINs; each build fetches the prices, which are never committed (Amazon allows keeping them 24 hours). | daily import (ASINs) and every build (prices) |
| eBay Browse API | eBay developer keys (`EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`), for live eBay listings and prices. Until then the "On eBay" card shows tagged used, new and recently-sold searches, which already earn. | daily import |
| Best Buy Products API | free key from developer.bestbuy.com (`BESTBUY_API_KEY`) | daily import |
| Affiliate-network product feeds | approval in the retailer's programme, then the feed URL as GitHub secret `FEED_URL_<KEY>` | daily import |
| Shopify products.json | nothing: public, read only where robots.txt allows (RiftCompare's method) | daily import |
| Shopify sitemaps + `/products/<handle>.js` | nothing: for Shopify stores whose robots.txt keeps out the paged catalogue but allows sitemaps and product pages (Ted's), or whose catalogue is mostly not cameras (JB Hi-Fi). Only handles the matcher reads as a catalog product (or an accessory) are fetched, one at a time, within a rotating budget | daily import |
| schema.org structured data | nothing: JSON-LD on a shop's own product pages, through its sitemaps, where robots.txt allows | daily import |

## How links earn

Links are set on Vercel (they are read when pages are built):

- **Amazon:** `AMAZON_TAG_US`, `AMAZON_TAG_UK`, `AMAZON_TAG_DE`,
  `AMAZON_TAG_AU`, `AMAZON_TAG_SG`. Each is a separate Associates account
  per store.
- **eBay:** the owner's EPN campaign 5339155912 is hard-coded
  (`src/lib/affiliate.ts`; `EBAY_AFFILIATE_CAMPAIGN` only overrides it). The
  code adds each site's rotation id and a `customid` naming the placement
  (`cc-<page>-<placement>`, e.g. `product-ebay-used`, `acc-ebay`,
  `home-ebay`, `promo-product`), so EPN's reports show which placement earns.
  Every eBay link is built in `src/lib/ebay-links.ts`. No eBay in Singapore
  (no EPN programme).
- **Everyone else:** `AFFILIATE_DEEPLINK_<KEY>`. Use the network's deep-link
  template with `{url}` (and optionally `{subid}`):

  | Network | Template |
  |---|---|
  | Impact | `https://<brand>.sjv.io/c/<pubId>/<adId>/<campaignId>?u={url}&subId1={subid}` (use the tracking domain Impact gives you) |
  | Awin | `https://www.awin1.com/cread.php?awinmid=<MID>&awinaffid=<YOUR_ID>&clickref={subid}&ued={url}` |
  | CJ | `https://www.anrdoezrs.net/click-<PID>-<AID>?url={url}&sid={subid}` |
  | Rakuten | `https://click.linksynergy.com/deeplink?id=<YOUR_ID>&mid=<MID>&murl={url}&u1={subid}` |
  | Partnerize | `https://prf.hn/click/camref:<CAMREF>/pubref:{subid}/destination:{url}` |
  | Webgains | `https://track.webgains.com/click.html?wgcampaignid=<CAMPAIGN>&wgprogramid=<PROGRAM>&clickref={subid}&wgtarget={url}` |
  | Commission Factory | the deep link the dashboard generates, with the product URL replaced by `{url}` |
  | B&H (own programme) | `&BI=<your BI>&KBID=<your KBID>`: a template starting with `&` appends parameters to B&H's own URL |
  | Lazada / Shopee | the deep-link format their affiliate dashboards give, with the product URL replaced by `{url}` |

A row whose link earns shows a filled button and a "Paid link" note. Offers
are still ordered by price.

After adding or removing a feed retailer:

```
npx tsx scripts/sync-workflow-feeds.ts
npx tsx scripts/gen-retailer-docs.ts
```

The first gives `refresh-prices.yml` the `FEED_URL_*` secret;
`tests/workflows.test.ts` checks it.

## Matching a listing to a product (`src/lib/matching.ts`)

The matcher tries, in order:

1. GTIN;
2. the maker's part number;
3. the title, where the brand must be named and an alias must match as whole
   words (so "Z6 II" never matches inside "Z6 III").

Refused outright:

- accessories, parts and film bodies;
- "… for Sony a7 IV" accessory phrasing;
- two different products in one title.

For lenses:

- the mount the title names must be one the lens is made for;
- a camera named next to a lens makes a camera kit, never a lens price.

A last sanity check refuses prices far below the launch price in the
listing's currency. Prices are never converted between currencies: a feed row
priced in another currency is refused.

## Retailers per market

<!-- RETAILERS-START -->
### 🇺🇸 United States (USD)

| Retailer | Ships from | Prices from | Affiliate programme | Link variable |
|---|---|---|---|---|
| Amazon.com ★ | US | Creators API (after the account's first sales) | Amazon Associates | `AMAZON_TAG_US` |
| B&H Photo ★ | US | Product feed `FEED_URL_BH` | Retailer's own programme | `AFFILIATE_DEEPLINK_BH` |
| Adorama ★ | US | Product feed `FEED_URL_ADORAMA` | Impact | `AFFILIATE_DEEPLINK_ADORAMA` |
| Best Buy | US | Products API (`BESTBUY_API_KEY`) | Impact | `AFFILIATE_DEEPLINK_BESTBUY` |
| Walmart | US | Product feed `FEED_URL_WALMART` | Impact | `AFFILIATE_DEEPLINK_WALMART` |
| Abt | US | Product feed `FEED_URL_ABT`; until then its pages' structured data | CJ | `AFFILIATE_DEEPLINK_ABT` |
| Moment | US | Shopify products.json (no setup) | Impact | `AFFILIATE_DEEPLINK_MOMENT` |
| Focus Camera | US | Shopify products.json (no setup) | none known | — |
| Beach Camera | US | Shopify products.json (no setup) | none known | — |
| Camera West | US | Shopify products.json (no setup) | Retailer's own programme | `AFFILIATE_DEEPLINK_CAMERA_WEST` |
| Pictureline | US | Shopify products.json (no setup) | none known | — |
| Camera Wholesalers | US | Shopify products.json (no setup) | none known | — |
| Helix Camera | US | Shopify products.json (no setup) | none known | — |
| Shop Panasonic | US | Shopify products.json (no setup) | none known | — |
| Leica Store Miami | US | Shopify products.json (no setup) | none known | — |
| Precision Camera | US | Structured data on its product pages (no setup) | none known | — |
| Dodd Camera | US | Structured data on its product pages (no setup) | none known | — |
| MPB ★ | US | Product feed `FEED_URL_MPB` | Partnerize | `AFFILIATE_DEEPLINK_MPB` |
| KEH | US | Product feed `FEED_URL_KEH` | Awin | `AFFILIATE_DEEPLINK_KEH` |
| eBay.com | US | Browse API (`EBAY_CLIENT_ID/SECRET`) | eBay Partner Network | EPN campaign 5339155912 (in the code) |

### 🇬🇧 United Kingdom (GBP)

| Retailer | Ships from | Prices from | Affiliate programme | Link variable |
|---|---|---|---|---|
| Amazon.co.uk ★ | GB | Creators API (after the account's first sales) | Amazon Associates | `AMAZON_TAG_UK` |
| Wex Photo Video | GB | Product feed `FEED_URL_WEX` | Impact | `AFFILIATE_DEEPLINK_WEX` |
| Park Cameras | GB | Product feed `FEED_URL_PARK_CAMERAS` | Rakuten Advertising | `AFFILIATE_DEEPLINK_PARK_CAMERAS` |
| Jessops ★ | GB | Product feed `FEED_URL_JESSOPS` | Partnerize | `AFFILIATE_DEEPLINK_JESSOPS` |
| Clifton Cameras | GB | Product feed `FEED_URL_CLIFTON_CAMERAS` | Awin | `AFFILIATE_DEEPLINK_CLIFTON_CAMERAS` |
| CameraWorld | GB | Product feed `FEED_URL_CAMERAWORLD` | Rakuten Advertising | `AFFILIATE_DEEPLINK_CAMERAWORLD` |
| London Camera Exchange | GB | Product feed `FEED_URL_LCE` | Webgains | `AFFILIATE_DEEPLINK_LCE` |
| Currys | GB | Product feed `FEED_URL_CURRYS` | Awin | `AFFILIATE_DEEPLINK_CURRYS` |
| MPB ★ | GB | Product feed `FEED_URL_MPB_UK` | Partnerize | `AFFILIATE_DEEPLINK_MPB_UK` |
| Harrison Cameras | GB | Shopify products.json (no setup) | none known | — |
| Cash Converters | GB | Structured data on its product pages (no setup) | none known | — |
| eBay.co.uk | GB | Browse API (`EBAY_CLIENT_ID/SECRET`) | eBay Partner Network | EPN campaign 5339155912 (in the code) |

### 🇪🇺 Europe (EUR)

| Retailer | Ships from | Prices from | Affiliate programme | Link variable |
|---|---|---|---|---|
| Amazon.de ★ | DE | Creators API (after the account's first sales) | Amazon Associates | `AMAZON_TAG_DE` |
| Calumet ★ | DE | Product feed `FEED_URL_CALUMET_DE` | Awin | `AFFILIATE_DEEPLINK_CALUMET_DE` |
| Foto Erhardt | DE | Product feed `FEED_URL_FOTO_ERHARDT` | Webgains | `AFFILIATE_DEEPLINK_FOTO_ERHARDT` |
| Cyberport | DE | Product feed `FEED_URL_CYBERPORT` | Retailer's own programme | `AFFILIATE_DEEPLINK_CYBERPORT` |
| MediaMarkt | DE | Product feed `FEED_URL_MEDIAMARKT_DE` | Retailer's own programme | `AFFILIATE_DEEPLINK_MEDIAMARKT_DE` |
| Coolblue | NL | Product feed `FEED_URL_COOLBLUE` | Awin | `AFFILIATE_DEEPLINK_COOLBLUE` |
| MPB ★ | DE | Product feed `FEED_URL_MPB_EU` | Partnerize | `AFFILIATE_DEEPLINK_MPB_EU` |
| eBay.de | DE | Browse API (`EBAY_CLIENT_ID/SECRET`) | eBay Partner Network | EPN campaign 5339155912 (in the code) |

### 🇦🇺 Australia (AUD)

| Retailer | Ships from | Prices from | Affiliate programme | Link variable |
|---|---|---|---|---|
| Amazon.com.au ★ | AU | Creators API (after the account's first sales) | Amazon Associates | `AMAZON_TAG_AU` |
| Ted's Cameras | AU | Shopify sitemaps and product .js (no setup) | none known | — |
| Digidirect | AU | Shopify products.json (no setup) | none known | — |
| Georges Cameras | AU | Shopify products.json (no setup) | none known | — |
| Camera Electronic | AU | Shopify products.json (no setup) | none known | — |
| Camera House ★ | AU | Product feed `FEED_URL_CAMERA_HOUSE`; until then its pages' structured data | Commission Factory | `AFFILIATE_DEEPLINK_CAMERA_HOUSE` |
| CameraPro ★ | AU | Product feed `FEED_URL_CAMERAPRO` | Commission Factory | `AFFILIATE_DEEPLINK_CAMERAPRO` |
| JB Hi-Fi ★ | AU | Product feed `FEED_URL_JBHIFI`; until then its Shopify sitemaps and product .js | Partnerize | `AFFILIATE_DEEPLINK_JBHIFI` |
| The Good Guys | AU | Product feed `FEED_URL_THE_GOOD_GUYS` only (own pages refused: robots.txt disallows /products/ (Shopify Hydrogen, no products.json)) | Partnerize | `AFFILIATE_DEEPLINK_THE_GOOD_GUYS` |
| Harvey Norman | AU | Product feed `FEED_URL_HARVEY_NORMAN` only (own pages refused: Imperva bot protection on every page, and product JSON-LD carries price 0 (prices load in the browser)) | none known | — |
| BIG W | AU | Product feed `FEED_URL_BIGW` only (own pages refused: drops plain requests (no answer, even to robots.txt)) | Impact | `AFFILIATE_DEEPLINK_BIGW` |
| Bunnings | AU | Product feed `FEED_URL_BUNNINGS` only (own pages refused: Cloudflare challenge on every page, robots.txt included) | none known | — |
| Cash Converters | AU | Structured data on its product pages (no setup) | none known | — |
| eBay.com.au | AU | Browse API (`EBAY_CLIENT_ID/SECRET`) | eBay Partner Network | EPN campaign 5339155912 (in the code) |

### 🇸🇬 Singapore (SGD)

| Retailer | Ships from | Prices from | Affiliate programme | Link variable |
|---|---|---|---|---|
| Amazon.sg ★ | SG | Creators API (after the account's first sales) | Amazon Associates | `AMAZON_TAG_SG` |
| Lazada ★ | SG | Link only | Lazada Affiliate | `AFFILIATE_DEEPLINK_LAZADA_SG` |
| Shopee ★ | SG | Link only | Shopee Affiliate | `AFFILIATE_DEEPLINK_SHOPEE_SG` |
| Challenger | SG | Shopify products.json (no setup) | none known | — |
| Cathay Photo ★ | SG | Link only | none known | — |
| Canon Store | SG | Shopify products.json (no setup) | none known | — |
| Sony Store | SG | Shopify products.json (no setup) | none known | — |
| Leica Store | SG | Shopify products.json (no setup) | none known | — |
| TK Foto | SG | Shopify products.json (no setup) | none known | — |
| Cash Converters | SG | Shopify products.json (no setup) | none known | — |
<!-- RETAILERS-END -->

## Researched but not listed (2026-10-17)

- **No affiliate programme found and no legitimate price source:** Samy's,
  Crutchfield, John Lewis, Ffordes, Camera Jungle, Foto Koch, Kamera Express,
  Fnac, Harvey Norman, Best Denki.
- **Price source exists but isn't built here yet:** MS Color (WooCommerce
  Store API; RiftCompare has the adapter) and Alan Photo.
- **Competitors already ranking for camera prices:** PriceSpy and PriceRunner
  (UK), idealo and Geizhals (EU), PriceHipster and StaticICE (AU), and Google
  Shopping everywhere.

## Checked for live prices, 2026-10-17

A plain request with CamCompare's User-Agent, from a cloud machine. GitHub's
runners may be treated differently.

- **Block plain requests (bot wall; skipped, not worked around):** B&H
  (robots.txt answers, sitemaps 403), MPB and KEH (Cloudflare challenge), Best
  Buy (503), Wex and Park Cameras (403), CameraWorld, Clifton Cameras, LCE,
  Bristol Cameras, Foto Koch, Digixo, Cameranu, Ryda, Cameras Direct AU
  (Cloudflare challenge), Foto Erhardt, Cyberport, Sony AU (403), Roberts
  Camera and Used Photo Pro (Cloudflare challenge on products.json).
- **robots.txt disallows the Shopify catalogue:** Hunt's Photo, Leica Camera
  USA, Sigma America, CameraPro, Ricoh Imaging Europe, Coolblue. (Ted's
  Cameras was here; since 2026-10-22 it is read through its sitemaps, below.)
- **Answer, but no usable product data yet:** Adorama and Unique Photo (no
  JSON-LD offer on product pages), Samy's (microdata price without a stated
  currency), Moment (sells only its own accessories now), JB Hi-Fi (Shopify,
  but camera collections come back empty and the full catalogue is mostly
  TVs and music).
- **Working via structured data:** Abt (until its CJ feed), Precision Camera,
  Dodd Camera.
- **Cash Converters AU and UK** (cashconverters.com.au, cashconverters.co.uk;
  one EPiServer platform behind Cloudflare, no challenge to a plain request):
  robots.txt allows `/shop` (it disallows only search, filter and query URLs),
  and each product page carries a JSON-LD Product/Offer with price, currency,
  `InStock` and `UsedCondition`. Product URLs don't name the item
  (`…/cameras/lenses-filters/camera-lens/001300347004`) and each site has
  roughly 230 (AU) / 180 (UK) product sitemaps of 1,000 URLs, about 1% of
  them lenses and digital bodies, and the category listing pages render their
  products in JavaScript. So both are read `slugless` (every camera-category
  URL is a candidate, matched on the page's own title) over a rotating window
  of 36 sitemaps and 200 pages a run (`sources/structured.ts`). Listing titles
  are the store's own and messy ("Canon Zoom Ef-S 18-55mm 1:3.5-5.6 Is Zoom
  Canon Eos Black"), so many copies match nothing; that only loses offers.
- **Next candidates:** MS Color and other WooCommerce shops (public Store
  API, SGD), Kamera Express, Calumet DE, Conns Cameras (EUR), Jessops, Mifsuds,
  Wilkinson (GBP) answer plain requests and need a per-site check.

## Australian stores checked, 2026-10-22

Friends' feedback (camera buyers and resellers in Australia) asked for every
big AU store. Each was checked with a plain request with CamCompare's
User-Agent from a cloud machine: platform, robots.txt, bot protection.

| Store | Platform | Result |
|---|---|---|
| Georges Cameras | Shopify | Already priced through products.json (no change). |
| digiDirect | Shopify | Already priced through products.json (no change). |
| Camera Electronic | Shopify | Already priced through products.json (no change). |
| Ted's Cameras | Shopify | **Added.** robots.txt has `Disallow: /*?limit=`, so `products.json?limit=250` stays out, but it allows `/sitemap.xml` and `/products/*`. So it is read through its 14 product sitemaps and `/products/<handle>.js` (Shopify's product JSON: price, compare-at price, `available`, tags, description), 150 products a run at one a second or slower (a 300-product test run took 54 minutes: the store answers slowly). Its second-hand stock (`…-secondhand` handles, vendor `USED`, "\| Secondhand" titles) comes in as used. |
| Camera House | Magento | **Added** as the fallback until its Commission Factory feed: robots.txt allows product pages, and each carries a JSON-LD Product/Offer (price, AUD, availability). About 27,000 sitemap URLs, many of them old products that redirect to a category, so only slugs the matcher reads are fetched, 250 a run. Its JSON-LD `gtin8` is the store's 5-digit SKU, so GTINs are now accepted only at real GTIN lengths (8, 12, 13, 14 digits). |
| JB Hi-Fi | Shopify (behind Cloudflare, no challenge) | **Added** as the fallback until its Partnerize feed. Its camera collections' products.json come back empty and the catalogue is about 108,000 products (music, film, TVs), so it is read through its 108 product sitemaps (a rotating 36 a run) and `/products/<handle>.js`, 250 a run. Its tag `AwaitingStock` is read as back-order. |
| The Good Guys | Shopify Hydrogen (headless) | **Refused:** robots.txt disallows `/products/`, and Hydrogen has no products.json. Feed needed: its affiliate page sends publishers to **Partnerize** (directories also list Commission Factory and Impact). Listed as `the-good-guys`, `FEED_URL_THE_GOOD_GUYS` / `AFFILIATE_DEEPLINK_THE_GOOD_GUYS`. |
| Harvey Norman | Magento behind Imperva | **Refused:** every page carries Imperva's bot-protection script (`_Incapsula_Resource`, which `blockedReason` stops at), and product JSON-LD has `price: 0` (prices load in the browser). Feed needed; no public affiliate programme found (its "Customer Direct Partner Program" is for brands selling through it). Listed as `harvey-norman` with no network. |
| BIG W | (Akamai) | **Refused:** drops plain requests (HTTP/2 reset; no answer even for robots.txt). Feed needed: directories list a BIG W programme on **Impact** (FlexOffers' listing is closed). Listed as `bigw`. |
| Bunnings | (Cloudflare) | **Refused:** Cloudflare challenge on every page, robots.txt included. No public affiliate programme found; it sells few cameras anyway. Listed as `bunnings` with no network. |
| Camera House, CameraPro | | Already listed as Commission Factory feed retailers. CameraPro's robots.txt still disallows its catalogue. |

The four refused chains are feed retailers with a `disabled` reason: the
import reports "FEED_URL_… not set; <reason>" until the feed exists. Their
affiliate networks come from public directories and the stores' own affiliate
pages, not from an approved account, so check them when applying.

Cash Converters pages name the branch that holds the item
(`store-details__title store-name`). It is read into each offer's `detail`
("Osborne Park store · Good"), so two identical Cash Converters rows can be
told apart.

## Japan and Hong Kong (researched 2026-10-22)

Research only: no market added. Checked with the same plain requests.

| Store | Market | Platform | Prices in | What we can read |
|---|---|---|---|---|
| Map Camera (mapcamera.com) | JP | Custom, Akamai | JPY | Answers plain requests. robots.txt returns the home page (no rules), and product pages are a client-rendered shell with no JSON-LD or OpenGraph price. **No usable source.** |
| Yodobashi (yodobashi.com) | JP | Akamai | JPY | Drops plain requests (HTTP/2 reset). **Bot wall.** |
| Bic Camera (biccamera.com) | JP | Akamai | JPY | Drops plain requests (HTTP/2 reset). **Bot wall.** |
| Kitamura (shop.kitamura.jp) | JP | Custom SPA | JPY | robots.txt blocks only Meta's and ByteDance's crawlers, but the store is a JavaScript app: no products.json, no product data in the HTML. **No usable source.** |
| Fujiya Camera (fujiya-camera.co.jp) | JP | futureshop | JPY | robots.txt allows us; its sitemaps list only categories and topics, no product pages. Would need category-page parsing. **Not worth it yet.** |
| Broadway (broadway.com.hk → broadwaylifestyle.com) | HK | Shopify | HKD (`/meta.json`) | products.json answers and robots.txt allows it. A general electronics chain: the first 250 products have no product types and almost no cameras. **Usable** with a collection filter or the sitemap mode. |
| Fortress (fortress.com.hk) | HK | Akamai | HKD | 403 "Access Denied" to every request. **Bot wall.** |
| Fotopro, Wing Shing, Tin Cheung, Hing Lee and other Mong Kok shops | HK | | HKD | No online catalogue with prices found. |

**Recommendation:** don't add Japan or Hong Kong yet. Japan's volume sits
with Yodobashi, Bic Camera and Map Camera: two are behind bot walls and the
third has no machine-readable prices. The way in would be affiliate product
feeds, as in the other markets. Japan's main networks are ValueCommerce and
A8.net; which of these chains run a programme there, and whether it includes
a feed, is not confirmed (not checked from an account). Japan becomes worth a
market once one such feed is approved, priced in JPY, with Amazon.co.jp through the
Creators API. Hong Kong has one readable Shopify store (Broadway) and the
camera specialists sell in person. A Hong Kong market would be one store
deep, so it can wait. Found along the way: Broadway's robots.txt ends its
lines with bare carriage returns, which the robots parser read as no rules at
all. It now splits on CR, LF and CRLF (RFC 9309), so a rule written that way
is obeyed.

