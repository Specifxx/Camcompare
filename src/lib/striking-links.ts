// Home-page links to the pages Search Console shows us on page two for a
// price query (SEO-6, 2026-11-10). One entry per page: the slug and the query's
// own wording as link text. Recorded in DECISIONS.md with each query's position
// on 10 Nov, so 25 Nov can compare like for like. A camera is shown only where
// its page in the visitor's market is indexable (productIndexable), so a link
// never points at a noindex page.
export const PRICE_CHECK_CAMERAS: readonly { slug: string; text: string }[] = [
  { slug: "leica-m11", text: "Leica M11 price" },
  { slug: "leica-q3", text: "Leica Q3 price" },
  { slug: "fujifilm-x100vi", text: "Fujifilm X100VI price" },
  { slug: "canon-eos-c500-mark-ii", text: "Canon EOS C500 Mark II price" },
  { slug: "nikon-z6-ii", text: "Nikon Z6 II price" },
  { slug: "nikon-z5-ii", text: "Nikon Z5 II price" },
  { slug: "panasonic-lumix-gh7", text: "Panasonic Lumix GH7 price" },
  { slug: "panasonic-lumix-s9", text: "Panasonic Lumix S9 price" },
  { slug: "hasselblad-x2d-ii-100c", text: "Hasselblad X2D II price" },
  { slug: "nikon-zr", text: "Nikon ZR price" },
];
