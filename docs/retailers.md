# Retailers and price sources

| Key | Retailer | Source | Conditions | Affiliate network |
|---|---|---|---|---|
| amazon | Amazon | Creators API (`AMAZON_CREATORS_*`, needs `amazonAsin` on the camera) | new, used, refurbished | Amazon Associates |
| bh | B&H Photo | product feed `FEED_URL_BH` | new, used, open box, refurbished | B&H's own programme |
| adorama | Adorama | product feed `FEED_URL_ADORAMA` | new, used, open box, refurbished | Impact |
| bestbuy | Best Buy | product feed `FEED_URL_BESTBUY` | new, open box | Impact |
| ebay | eBay | Browse API (`EBAY_CLIENT_*`) | all | eBay Partner Network |
| mpb | MPB | product feed `FEED_URL_MPB` | used | FlexOffers |
| keh | KEH | product feed `FEED_URL_KEH` | used | KEH's programme |

The registry is `src/lib/retailers.ts`. A source that isn't configured is
reported as `skip` and contributes nothing. One that fails keeps yesterday's
offers for up to 72 hours, so a broken feed never empties the site.

## Matching a listing to a camera (`src/lib/matching.ts`)

The matcher tries GTIN first, then the maker's part number, then the title.
A title match needs the brand named, and an alias that matches whole title
words (so "Z6 II" never matches inside "Z6 III"). Accessories, parts and "for
Sony a7 IV" phrasing are refused. Two different cameras in one title is
refused, not guessed. A kit (body plus lens) is shown but never counted as
the body price. A last sanity check refuses new prices under 45% of launch
and used under 15%.

## Adding a retailer

1. Add it to `RETAILERS` with `source: "feed"`.
2. Add `FEED_URL_<KEY>` to `refresh-prices.yml`.
3. Add `AFFILIATE_DEEPLINK_<KEY>` on Vercel.

If the feed's column names aren't recognised, add them to `FIELDS` in
`src/lib/sources/feed.ts`. The import reports "none matched" instead of
silently returning nothing.
