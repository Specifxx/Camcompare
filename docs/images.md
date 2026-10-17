# Product images

Rule (owner, 2026-10-17): **every listed product has a thumbnail.** A camera
or lens without one is not published: it gets no page and appears in no
listing, search result or sitemap (`src/lib/catalog/index.ts`).

Each published product has two files:

- `public/products/<slug>.webp`: 640 px wide, under 150 KB;
- `data/image-credits/<slug>.json`: author, licence, licence URL and source
  page. The product page and `/credits` print these, as CC BY and CC BY-SA
  require.

`tests/catalog.test.ts` fails if a credit has no file, a file has no credit,
or a file is over budget.

## Automatic: `npm run thumbs:fetch`

For every product without a thumbnail it tries, in order:

1. **Wikidata**: the photo (P18) on the product's Wikidata item, found by an
   explicit `wikidata` id or an unambiguous name match;
2. **Commons search**: a Wikimedia Commons file whose *name* the listing
   matcher (`matchListing`) reads as exactly this product;
3. **Openverse**: a photo (mostly Flickr) whose title the matcher reads as
   this product.

Only CC0, public-domain, CC BY and CC BY-SA files are taken. No NC or ND.
Openverse allows 200 anonymous searches a day; `OPENVERSE_TOKEN` raises that.

## Check by eye before it ships

A search hit (2 or 3) can be the right name on the wrong picture: a sample
photo taken with the camera, two cameras side by side, a box, the previous
generation. So every one is looked at:

```
npm run thumbs:sheet -- slug1,slug2,…    # labelled contact sheet
npm run thumbs:reject -- slug1,slug2     # wrong photo: remove it
```

`thumbs:reject` deletes the image and credit and records the file in
`data/image-rejects/<slug>.json`, so the next fetch never picks it again and
tries the next candidate instead.

## Manual: press images

For a product with no free photo, the maker's press image is the fallback,
but most press kits allow editorial use only. Check that maker's terms first,
then:

1. save it as `public/products/<slug>.webp`, 640 px wide, under 150 KB;
2. write `data/image-credits/<slug>.json` with `"source": "press"`,
   `"provider"` and `"author"` set to the maker, `"file"` to the image URL,
   `"pageUrl"` to the press page, `"license": "Press image"`,
   `"licenseUrl": null`, `"wikidata": null`, and the image's `width` and
   `height` (the schema is `imageCreditSchema` in `src/lib/images.ts`).

Retailer feed images are allowed under most affiliate programmes, but only to
promote that retailer's offer. Don't use them as the catalog photo.
