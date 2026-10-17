# Owner checklist: what only you can do

Nothing here needs code. Most of it is in
[`chrome-setup-prompt.md`](chrome-setup-prompt.md): paste that prompt into
Claude in Chrome and it works through the list in your browser, stopping
before anything that costs money, signs an agreement or needs your tax or bank
details.

**No database.** All public data is JSON in this repo. There is nothing to set
up in Neon.

1. **GitHub.** Create `main` from the working branch and make it the default.
   Allow Actions to write (the daily price job commits to `main`).
2. **Vercel project** for this repo, on a Pro team (Hobby is non-commercial),
   production branch `main`. Then a domain and `NEXT_PUBLIC_SITE_URL`.
3. **Affiliate programmes.** Apply once the site is live, because programmes
   review the site:
   - **Amazon Associates**: one account per store (US, UK, Germany, Australia,
     Singapore). `AMAZON_TAG_US` … `AMAZON_TAG_SG`. Until the Creators API
     opens (10 sales in 30 days), Amazon rows show a tagged "Check price"
     button with no price; Amazon allows a price only from its API.
   - **eBay Partner Network**: a new CamCompare campaign in your existing
     account (`EBAY_AFFILIATE_CAMPAIGN`). Until the eBay developer keys exist
     (`EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`), the eBay panel beside the price
     table is a tagged "Search eBay" link.
   - **Camera retailers** in five markets, through Impact, Awin, Partnerize,
     Rakuten, Webgains, CJ, Commission Factory and their own programmes: the
     full list with each variable is in [`retailers.md`](retailers.md). For
     each one approved, the deep-link template goes in the Vercel variable
     `AFFILIATE_DEEPLINK_<KEY>` and any product feed in the GitHub secret
     `FEED_URL_<KEY>`.
   - **Best Buy developer API**: a free key, `BESTBUY_API_KEY`.
4. **GitHub secrets** for `refresh-prices.yml`, then run it once by hand and
   read its "Check sources" step.
5. **Search Console and Bing Webmaster.** Verify with the meta-tag codes
   (`GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`) and submit
   `/sitemap.xml`.
6. **Ads, later.** Apply to AdSense once the site has traffic and the guides.
   Slots render nothing until `NEXT_PUBLIC_ADSENSE_CLIENT` and slot ids are
   set.
7. **Spec spot-checks.** `npm run wikidata:crosscheck` flags specs that
   disagree with Wikidata. Check the flagged ones against the maker's spec
   sheet; recent bodies matter most.
8. **Missing photos.** `npm run thumbs:fetch` lists the products no free
   licence photo was found for. Each stays unpublished until it has one
   (`images.md`). Makers' press images need the maker's permission.
