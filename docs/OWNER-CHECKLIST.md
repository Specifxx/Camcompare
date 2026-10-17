# Owner checklist: what only you can do

In order. Nothing here needs code.

1. **Domain.** Buy one and set `NEXT_PUBLIC_SITE_URL` on Vercel.
2. **Vercel project** for this repo, on a Pro team (Hobby is non-commercial),
   production branch `main`.
3. **Affiliate programmes.** Apply once the site is live with the catalog,
   because programmes review the site:
   - **Amazon Associates**: add the new site to your existing account and make
     a new tracking id (for example `camcompare-20`), then request **Creators
     API** credentials (Associates Central > Tools > Creators API). Set
     `AMAZON_ASSOCIATE_TAG`, `AMAZON_CREATORS_CLIENT_ID` and
     `AMAZON_CREATORS_CLIENT_SECRET`.
   - **eBay Partner Network**: new campaign in your existing account
     (`EBAY_AFFILIATE_CAMPAIGN`). Reuse your eBay developer keys
     (`EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`).
   - **Impact**: Adorama and Best Buy. **B&H**: its own programme.
     **FlexOffers**: MPB. **KEH**: its programme. For each, once approved:
     - copy the **product feed URL** into the GitHub secret `FEED_URL_<KEY>`;
     - copy the **deep-link template** into the Vercel variable
       `AFFILIATE_DEEPLINK_<KEY>` (see `.env.example` for each network's
       format).
4. **GitHub secrets** for `refresh-prices.yml`: the import variables in
   `.env.example`.
5. **Spec pass.** Run `npm run wikidata:crosscheck`, then check every camera
   it flags against the maker's spec sheet. The 2025 bodies matter most.
6. **Missing photos.** `npm run thumbs:fetch` lists the cameras Commons has no
   free photo for. Decide whether to use makers' press images
   (`docs/images.md`).
7. **Search Console and Bing Webmaster.** Submit `/sitemap.xml`.
