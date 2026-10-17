// The camera catalog's shape. Every file in data/cameras/ is parsed with
// `cameraSchema`; scripts/check-catalog.ts (run by `npm run build`) and
// tests/catalog.test.ts fail on any file that does not parse, so a typo in
// the data can never reach a page.
//
// Specs are FACTS from the manufacturer's spec sheet. Leave a field `null`
// rather than guess: a page renders null as "—", and a wrong number on a
// comparison page is worse than a missing one.
import { z } from "zod";

export const CAMERA_TYPES = ["mirrorless", "dslr", "compact", "medium-format", "rangefinder"] as const;

export const SENSOR_FORMATS = [
  "medium-format",
  "full-frame",
  "aps-h",
  "aps-c",
  "micro-four-thirds",
  "1.4-inch",
  "1-inch",
  "1/1.3-inch",
  "1/2.3-inch",
] as const;

export const SCREEN_TYPES = ["fully-articulating", "tilting", "multi-angle", "flip-up", "fixed", "none"] as const;

// Release-year floor (owner, 2026-10-17: "cameras from the 2000s, you
// probably don't need"). Older bodies may stay only with a `keepReason`:
// still sold new, or still a high-volume used buy.
export const CATALOG_FLOOR_YEAR = 2016;

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "kebab-case slug");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
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
    // 35mm-equivalent focal length: one value for a prime, [wide, tele] for a zoom
    focalMm: z.union([z.tuple([z.number().positive()]), z.tuple([z.number().positive(), z.number().positive()])]),
    aperture: z.string().regex(/^f\/\d+(\.\d+)?(-\d+(\.\d+)?)?$/), // "f/2.8" or "f/1.8-2.8"
  })
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
