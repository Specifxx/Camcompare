# Camera images

Rule (owner, 2026-10-17): **every listed camera has a thumbnail.** A camera
without one is not published: it gets no page and appears in no listing
(`src/lib/catalog/index.ts`).

## Automatic: Wikimedia Commons

`npm run thumbs:fetch` links each camera to its Wikidata item (an explicit
`wikidata` id, otherwise an unambiguous name or Exif-model match). It takes
the item's photo (P18) **only if it is CC0, CC BY, CC BY-SA or public
domain**, then writes:

- `public/cameras/<slug>.webp`: 640 px wide, under 150 KB;
- `data/image-credits.json`: author, licence and source page. The camera page
  and `/credits` print these, as CC BY and CC BY-SA require.

`tests/catalog.test.ts` fails if a credit has no file, a file has no credit,
or a file is over budget.

## Manual: press images

For a camera Commons has no free photo of, use the maker's press image (most
makers allow editorial use of press-kit images; check that maker's terms):

1. save it as `public/cameras/<slug>.webp`, 640 px wide, under 150 KB;
2. add a credit with `"source": "press"`, `"author": "<Maker>"`,
   `"license": "Press image"`, and `pageUrl` set to the press page.

Retailer feed images are allowed under most affiliate programmes, but only
for promoting that retailer's offer. Don't use them as the camera's catalog
photo.
