# Writing catalog files

How a camera body (`data/cameras/<slug>.json`) or lens
(`data/lenses/<slug>.json`) file is written. The schema is
`src/lib/catalog/schema.ts`. Files are `.strict()`: every key in the exemplar
must be present, and no others.

- Camera exemplar: `data/cameras/sony-a7-iv.json`
- Lens exemplar: `data/lenses/sony-fe-24-70mm-f2-8-gm-ii.json`

Check a batch with `CHECK_ONLY=slug1,slug2 npx tsx scripts/check-catalog.ts`.
"References … which is not in the catalog" is expected while other batches
are still being written. Everything else must be fixed.

## The one rule

**Specs are facts from the maker's spec sheet. When you are not sure, write
`null`.** A dash on the page is fine; a wrong number on a comparison page is
not. Prefer the maker's own spec page, then the maker's manual or datasheet
PDF, then DPReview's spec page. Never fill a value from a forum or a retailer
listing.

## Slugs and names

- Slug: `<brand slug>-<model as the maker prints it>`, lowercased, with every
  run of spaces, dots, slashes and `|` becoming one `-`. Drop the word "lens".
  - Bodies: `sony-a7-iv`, `canon-eos-r6-mark-ii`, `nikon-z6-iii`,
    `fujifilm-x-t5`, `panasonic-lumix-s5-ii`, `om-system-om-1`,
    `olympus-om-d-e-m1-mark-iii`, `pentax-k-1-mark-ii`, `gopro-hero13-black`,
    `dji-osmo-pocket-3`, `insta360-x4`.
  - Lenses: `sony-fe-24-70mm-f2-8-gm-ii`, `canon-rf-24-70mm-f2-8l-is-usm`,
    `nikon-z-24-70mm-f2-8-s`, `fujifilm-xf-16-55mm-f2-8-r-lm-wr`,
    `sigma-24-70mm-f2-8-dg-dn-art-ii`, `tamron-28-75mm-f2-8-di-iii-vxd-g2`.
- `brand` is a slug from `data/brands.json`. Pentax products are brand
  `ricoh`; Olympus products are brand `om-system`; Rokinon is `samyang`.
- `name` is the full marketing name with the brand ("Sony FE 24-70mm F2.8 GM
  II"). `shortName` drops the brand ("FE 24-70mm F2.8 GM II").
- `regionalNames`: only when a market sells it under another name. The Canon
  EOS Rebel T7 is `{"uk": "Canon EOS 2000D", "eu": "Canon EOS 2000D", "au":
  "Canon EOS 2000D", "sg": "Canon EOS 2000D"}`. A Lumix ZS is a TZ outside
  the US; a Lumix G85 is a G80. Every regional name also goes in `aliases`.

## Aliases and model codes

The price importer finds a product in retailer titles by its aliases, as
runs of whole words, with the brand also named in the title. So:

- List every spelling retailers use: "a7 IV", "a7IV", "Alpha 7 IV", "A7M4";
  "EOS R6 Mark II", "R6 Mark II", "R6 II"; "24-70mm F2.8 GM II",
  "24-70mm f/2.8 G Master II", "24-70 GM II".
- Every alias must be **specific to this product**. Never a bare focal length
  and aperture ("24-70mm F2.8") and never a bare series ("R6" for the R6 Mark
  II). Include the series mark (GM, L, S, Art, DG DN, VXD, G2, R LM WR, PRO).
  The checker rejects an alias that, lowercased and stripped to a–z/0–9,
  equals another product's alias.
- `modelCodes`: the maker's part numbers (ILCE-7M4, SEL2470GM2, DC-S5M2,
  2955C002). Leave `[]` if you aren't sure.
- `gtins`: leave `[]`. They are filled from Wikidata and the retailer feeds.

## Dates, prices, status

- `announced`: the announcement date, YYYY-MM-DD. Not a development
  announcement.
- `launchPriceUsd`: the US list price at launch, exactly as published,
  cents included (2299.99 or 2499). Body only for cameras. If the US only
  ever sold it as a kit, or you aren't sure, write `null`.
- `launchPrices`: launch prices in GBP, EUR, AUD and SGD, only those you can
  confirm, VAT/GST included. Omit the key entirely when unknown.
- A launch price in at least one market is what lets eBay and title-only feeds
  price a product: with none anywhere, only a barcode or part-number match is
  trusted (`plausiblePrice`). It is worth a search before writing `null`.
- `status`: `"discontinued"` only when the maker has stopped selling it (a
  successor replaced it, or it is gone from the maker's site). Otherwise
  `"current"`.
- `predecessor` and `successor` are slugs in this catalog, and must agree
  (A.successor = B means B.predecessor = A). Use `null` when the real one
  isn't in the catalog.
- `rivals`: slugs of products buyers really cross-shop. For lenses, leave
  `[]`; a later pass fills lens rivals across brands.
- Before 2012 (`CATALOG_FLOOR_YEAR`): add `keepReason` saying why it stays.

## Camera specs

| Field | Convention |
|---|---|
| `megapixels` | effective |
| `isoMin` / `isoMax` | native range, not extended |
| `ibis`, `ibisStops` | sensor-shift stabilisation; stops = the maker's headline CIPA figure (with lens IS coordination if that is the headline). Action cameras use electronic stabilisation: `ibis: false` |
| `burstMechFps` / `burstElecFps` | fastest full-resolution rate; crop modes count, reduced-resolution modes don't. `null` when the body has no mechanical shutter |
| `shutterMaxMech` / `Elec` | denominator: 8000 means 1/8000 s |
| `afPoints` | the maker's count (Canon mirrorless: AF zones). Never ranked |
| `afSubjects` | only the maker's own categories: human, animal, bird, vehicle, aircraft, train, insect. `[]` if none; `null` if unknown |
| `videoMaxRes` | "4K", "5.3K", "6.2K", "8K", "1080p" |
| `video4kMaxFps` | highest 4K frame rate, any crop. `null` without 4K |
| `video10bit` | internal recording only (10-bit only over HDMI = `false`) |
| `rawVideoInternal` | internal raw recording (ProRes RAW, BRAW, N-RAW, Cinema RAW Light) |
| `viewfinderType`, `evfDotsM` | EVF dots in millions; optical/none → `evfDotsM: null` |
| `screenType` | fully-articulating, tilting, multi-angle (tilts two or three ways), flip-up (selfie flip), fixed, none |
| `weightG` | with battery and card (CIPA) |
| `dimensionsMm` | [W, H, D] |
| `batteryShotsCipa` | rear-screen figure; DSLRs (rated through the viewfinder) `null` |
| `waterproofM` | rated depth without a housing (action, rugged); else `null` |

Types:

- `mirrorless`, `dslr`, `rangefinder` (Leica M), `medium-format`;
- `compact` (any fixed-lens stills camera, bridge and rugged included);
- `action` (GoPro, Osmo Action, Insta360 Ace);
- `360` (Insta360 X, GoPro MAX, Ricoh Theta);
- `cinema` (FX6, FX9, Burano, C70, C80, C300 III, C400, Pocket 6K, Komodo,
  BGH1, BS1H).

Fixed-lens cameras:

- `mount: null` and `fixedLens: {focalMm: [35] or [24, 72], aperture:
  "f/2" or "f/1.8-2.8"}`.
- `focalMm` is 35mm-equivalent. It is `null` where makers quote none (360
  cameras).
- Cinema bodies with interchangeable lenses keep a `mount`.

## Lens specs

| Field | Convention |
|---|---|
| `mounts` | every mount the lens is made for (third-party lenses list each version). One product, not one per mount |
| `coverage` | full-frame, aps-c (EF-S, RF-S, DX, Sony E non-FE, XF), micro-four-thirds, medium-format |
| `focalMinMm` / `focalMaxMm` | real focal length; equal for a prime |
| `apertureMax` | widest aperture at the wide end (2.8 = f/2.8) |
| `apertureMaxTele` | widest at the long end; `null` for constant-aperture zooms and primes |
| `apertureMin` | smallest aperture at the wide end |
| `afMotor` | the maker's name for the motor; `null` for manual focus |
| `stabilized` | optical stabilisation in the lens |
| `lengthMm` | at the shortest, without caps, from the mount flange |
| `minFocusM` | closest focus in metres (the wide end for zooms) |
| `maxMagnification` | 0.25 for 1:4; 1 for life size |
| `internalZoom` | `null` for primes |
| `teleconverter` | accepts the maker's teleconverters |
