// The catalog's shape: camera bodies (data/cameras/, `cameraSchema`) and
// lenses (data/lenses/, `lensSchema`). scripts/check-catalog.ts (run by
// `npm run build`) and tests/catalog.test.ts fail on any file that does not
// parse, so a typo in the data can never reach a page.
//
// Specs are FACTS from the manufacturer's spec sheet. Leave a field `null`
// rather than guess: a page renders null as "—", and a wrong number on a
// comparison page is worse than a missing one.
import { z } from "zod";

// "compact" covers every fixed-lens stills camera: premium, travel-zoom,
// bridge and rugged. "action" = GoPro-style, "360" = dual-lens spherical,
// "cinema" = video-first bodies without a stills focus (FX6, C70, Pocket 6K).
export const CAMERA_TYPES = ["mirrorless", "dslr", "compact", "medium-format", "rangefinder", "action", "360", "cinema"] as const;

export const SENSOR_FORMATS = [
  "medium-format",
  "full-frame",
  "aps-h",
  "super-35",
  "aps-c",
  "micro-four-thirds",
  "1.4-inch",
  "1-inch",
  "2/3-inch",
  "1/1.28-inch",
  "1/1.3-inch",
  "1/1.7-inch",
  "1/1.9-inch",
  "1/2-inch",
  "1/2.3-inch",
  "1/2.8-inch",
] as const;

// What a lens's image circle covers. A full-frame lens also covers APS-C.
export const LENS_COVERAGE = ["medium-format", "full-frame", "aps-c", "micro-four-thirds"] as const;

export const SCREEN_TYPES = ["fully-articulating", "tilting", "multi-angle", "flip-up", "fixed", "none"] as const;

// Release-year floor (owner, 2026-10-17: "cameras from the 2000s, you
// probably don't need"). 2012 rather than 2016 since the 1,000-product
// expansion: bodies and lenses from 2012-15 (a7 II, D750, 5D III, X-T1, EF
// 24-70 II) still trade used in volume, and used prices are the site's
// wedge. Anything older stays only with a `keepReason`.
export const CATALOG_FLOOR_YEAR = 2012;

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "kebab-case slug");
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")
  .refine((d) => {
    // 2024-02-30 would show as "Mar 2024"; 2023-13-01 as "Invalid Date".
    const t = Date.parse(`${d}T00:00:00Z`);
    return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === d;
  }, "not a real date");
const nullableNumber = z.number().positive().nullable();

export const specsSchema = z
  .object({
    // Sensor
    sensorFormat: z.enum(SENSOR_FORMATS),
    sensorType: z.string().min(2).nullable(), // "BSI CMOS", "Stacked CMOS", "X-Trans CMOS 5 HR"
    megapixels: z.number().positive(), // effective
    isoMin: nullableNumber, // native, not extended
    isoMax: nullableNumber,
    ibis: z.boolean().nullable(),
    ibisStops: nullableNumber, // CIPA rating, best case quoted by the maker
    // Speed
    burstMechFps: nullableNumber,
    burstElecFps: nullableNumber,
    shutterMaxMech: nullableNumber, // denominator: 8000 means 1/8000s
    shutterMaxElec: nullableNumber,
    afPoints: nullableNumber, // phase-detect points / zones as the maker counts them
    afSubjects: z.array(z.enum(["human", "animal", "bird", "vehicle", "aircraft", "train", "insect"])).nullable(),
    // Video
    videoMaxRes: z.string().regex(/^(\d+(\.\d+)?K|1080p|720p)$/).nullable(), // "4K", "6.2K", "8K"
    video4kMaxFps: nullableNumber,
    video10bit: z.boolean().nullable(),
    rawVideoInternal: z.boolean().nullable(),
    // Viewfinder & screen
    evfDotsM: nullableNumber, // millions of dots; null = no electronic viewfinder
    viewfinderType: z.enum(["electronic", "optical", "hybrid", "none"]),
    screenSizeIn: nullableNumber,
    screenDotsM: nullableNumber,
    screenType: z.enum(SCREEN_TYPES),
    touchscreen: z.boolean().nullable(),
    // Body
    weightG: nullableNumber, // with battery and card (CIPA)
    dimensionsMm: z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]).nullable(), // W x H x D
    weatherSealed: z.boolean().nullable(),
    waterproofM: nullableNumber, // rated depth without a housing (action and rugged cameras); null otherwise
    cardSlots: z.number().int().min(0).nullable(),
    cardTypes: z.string().nullable(), // "CFexpress B + SD UHS-II"
    batteryShotsCipa: nullableNumber, // using the rear screen
    usbC: z.boolean().nullable(),
    micJack: z.boolean().nullable(),
    headphoneJack: z.boolean().nullable(),
    builtInFlash: z.boolean().nullable(),
    wifi: z.boolean().nullable(),
    bluetooth: z.boolean().nullable(),
  })
  .strict();

export const fixedLensSchema = z
  .object({
    // 35mm-equivalent focal length: one value for a prime, [wide, tele] for a
    // zoom; null where makers quote none (360 cameras)
    focalMm: z.union([z.tuple([z.number().positive()]), z.tuple([z.number().positive(), z.number().positive()])]).nullable(),
    aperture: z.string().regex(/^f\/\d+(\.\d+)?(-\d+(\.\d+)?)?$/).nullable(), // "f/2.8" or "f/1.8-2.8"
  })
  .strict();

// Launch prices outside the US, in local currency (VAT/GST included, as
// advertised). US launch price stays in `launchPriceUsd`.
export const launchPricesSchema = z
  .object({ GBP: z.number().positive(), EUR: z.number().positive(), AUD: z.number().positive(), SGD: z.number().positive() })
  .partial()
  .strict();

// The name a market sells it under, when it differs from `name`
// (Canon EOS Rebel T7 is the EOS 2000D outside North America; Lumix ZS is TZ).
export const regionalNamesSchema = z
  .object({ uk: z.string().min(2), eu: z.string().min(2), au: z.string().min(2), sg: z.string().min(2) })
  .partial()
  .strict();

export const cameraSchema = z
  .object({
    slug,
    brand: slug, // key into data/brands.json
    name: z.string().min(2), // full display name: "Sony α7 IV"
    shortName: z.string().min(1), // "α7 IV"
    // Every spelling a retailer title uses. The title matcher (lib/matching.ts)
    // treats these as whole tokens, so "a7 IV" never matches "a7 IV battery".
    aliases: z.array(z.string().min(2)).min(1),
    modelCodes: z.array(z.string().min(2)), // maker part numbers: "ILCE-7M4"
    gtins: z.array(z.string().regex(/^\d{8,14}$/)), // UPC/EAN of the BODY-ONLY sku
    type: z.enum(CAMERA_TYPES),
    announced: isoDate,
    launchPriceUsd: z.number().positive().nullable(), // body only, US MSRP at launch
    launchPrices: launchPricesSchema.optional(),
    regionalNames: regionalNamesSchema.optional(),
    status: z.enum(["current", "discontinued"]),
    predecessor: slug.nullable(),
    successor: slug.nullable(),
    rivals: z.array(slug), // the cameras buyers cross-shop; drives the indexed /compare pages
    mount: slug.nullable(), // key into data/mounts.json; null for fixed-lens cameras
    fixedLens: fixedLensSchema.nullable(),
    specs: specsSchema,
    keepReason: z.string().min(10).optional(), // required when announced before CATALOG_FLOOR_YEAR
    amazonAsin: z.string().regex(/^B[0-9A-Z]{9}$/).optional(),
    wikidata: z.string().regex(/^Q\d+$/).optional(),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (Number(c.announced.slice(0, 4)) < CATALOG_FLOOR_YEAR && !c.keepReason) {
      ctx.addIssue({ code: "custom", path: ["keepReason"], message: `announced before ${CATALOG_FLOOR_YEAR}: say why it stays` });
    }
    if ((c.mount === null) !== (c.fixedLens !== null)) {
      ctx.addIssue({ code: "custom", path: ["mount"], message: "exactly one of mount / fixedLens" });
    }
    if (c.specs.viewfinderType === "none" && c.specs.evfDotsM !== null) {
      ctx.addIssue({ code: "custom", path: ["specs", "evfDotsM"], message: "no viewfinder but EVF dots set" });
    }
  });

export type Camera = z.infer<typeof cameraSchema>;
export type Specs = z.infer<typeof specsSchema>;
export type CameraType = (typeof CAMERA_TYPES)[number];
export type SensorFormat = (typeof SENSOR_FORMATS)[number];

// ---------------------------------------------------------------- lenses

const aperture = z.number().min(0.7).max(64); // f-number: 2.8 means f/2.8

export const lensSpecsSchema = z
  .object({
    focalMinMm: z.number().positive(), // real focal length, not 35mm-equivalent
    focalMaxMm: z.number().positive(), // equal to focalMinMm for a prime
    apertureMax: aperture, // widest aperture at the wide end
    apertureMaxTele: aperture.nullable(), // widest at the long end; null when constant or a prime
    apertureMin: aperture.nullable(),
    autofocus: z.boolean(),
    afMotor: z.string().min(2).nullable(), // "Linear", "XD Linear", "STM", "Nano USM", "HyperSonic"
    stabilized: z.boolean().nullable(), // optical stabilisation in the lens
    weatherSealed: z.boolean().nullable(),
    weightG: nullableNumber,
    diameterMm: nullableNumber,
    lengthMm: nullableNumber, // at the shortest, without caps
    filterMm: nullableNumber, // null when the lens takes no front filter
    minFocusM: nullableNumber,
    maxMagnification: nullableNumber, // 0.25 = 1:4, 1 = life size
    elements: z.number().int().positive().nullable(),
    groups: z.number().int().positive().nullable(),
    apertureBlades: z.number().int().positive().nullable(),
    internalZoom: z.boolean().nullable(), // null for primes
    apertureRing: z.boolean().nullable(),
    teleconverter: z.boolean().nullable(), // accepts the maker's teleconverters
  })
  .strict();

export const lensSchema = z
  .object({
    slug,
    brand: slug,
    name: z.string().min(2), // "Sony FE 24-70mm F2.8 GM II"
    shortName: z.string().min(1), // "FE 24-70mm F2.8 GM II"
    aliases: z.array(z.string().min(2)).min(1),
    modelCodes: z.array(z.string().min(2)), // "SEL2470GM2"
    gtins: z.array(z.string().regex(/^\d{8,14}$/)),
    announced: isoDate,
    launchPriceUsd: z.number().positive().nullable(),
    launchPrices: launchPricesSchema.optional(),
    regionalNames: regionalNamesSchema.optional(),
    status: z.enum(["current", "discontinued"]),
    predecessor: slug.nullable(),
    successor: slug.nullable(),
    rivals: z.array(slug),
    // Every mount it is made for. Third-party lenses list each version
    // (Sigma 24-70 DG DN Art II: sony-e, l-mount); one product, not one per mount.
    mounts: z.array(slug).min(1),
    coverage: z.enum(LENS_COVERAGE),
    specs: lensSpecsSchema,
    keepReason: z.string().min(10).optional(),
    amazonAsin: z.string().regex(/^B[0-9A-Z]{9}$/).optional(),
    wikidata: z.string().regex(/^Q\d+$/).optional(),
  })
  .strict()
  .superRefine((l, ctx) => {
    if (Number(l.announced.slice(0, 4)) < CATALOG_FLOOR_YEAR && !l.keepReason) {
      ctx.addIssue({ code: "custom", path: ["keepReason"], message: `announced before ${CATALOG_FLOOR_YEAR}: say why it stays` });
    }
    const s = l.specs;
    if (s.focalMaxMm < s.focalMinMm) ctx.addIssue({ code: "custom", path: ["specs", "focalMaxMm"], message: "shorter than focalMinMm" });
    if (s.focalMaxMm === s.focalMinMm && (s.apertureMaxTele !== null || s.internalZoom !== null)) {
      ctx.addIssue({ code: "custom", path: ["specs"], message: "a prime has no apertureMaxTele or internalZoom (use null)" });
    }
    if (s.apertureMaxTele !== null && s.apertureMaxTele < s.apertureMax) {
      ctx.addIssue({ code: "custom", path: ["specs", "apertureMaxTele"], message: "wider than the wide end" });
    }
    if (s.elements !== null && s.groups !== null && s.groups > s.elements) {
      ctx.addIssue({ code: "custom", path: ["specs", "groups"], message: "more groups than elements" });
    }
  });

export type Lens = z.infer<typeof lensSchema>;
export type LensSpecs = z.infer<typeof lensSpecsSchema>;
export type LensCoverage = (typeof LENS_COVERAGE)[number];
export type ProductKind = "camera" | "lens";
export type Product = ({ kind: "camera" } & Camera) | ({ kind: "lens" } & Lens);

export const brandSchema = z
  .object({ slug, name: z.string(), country: z.string(), site: z.string().url(), sublines: z.array(z.string()).optional() })
  .strict();
export type Brand = z.infer<typeof brandSchema>;

export const mountSchema = z
  .object({
    slug,
    name: z.string(),
    brand: slug.nullable(), // null for alliance mounts (L-Mount, Micro Four Thirds)
    flangeMm: z.number().positive(),
    formats: z.array(z.enum(SENSOR_FORMATS)).min(1),
    introduced: z.number().int(),
    status: z.enum(["current", "legacy"]),
  })
  .strict();
export type Mount = z.infer<typeof mountSchema>;
