import assert from "node:assert/strict";
import { test } from "node:test";
import { buildIndex, compact, launchIn, matchListing, mountInTitle, plausiblePrice } from "../src/lib/matching";
import { CAMERAS, LENSES, cam, lensFix } from "./fixtures";

const index = buildIndex(CAMERAS, LENSES);
const slug = (title: string, extra: { gtin?: string; mpn?: string } = {}, want?: "camera" | "lens") => {
  const m = matchListing({ title, ...extra }, index, want);
  return m.product ? m.product.slug : null;
};

test("compact folds Mark/Mk spellings and α", () => {
  assert.equal(compact("Canon EOS R6 Mark II"), compact("canon eos r6 ii"));
  assert.equal(compact("R6 Mk2"), "r6ii");
  assert.equal(compact("Sony α7 IV"), "sonya7iv");
});

test("numbered generations never collide", () => {
  assert.equal(slug("Sony Alpha a7 IV Mirrorless Digital Camera Body"), "sony-a7-iv");
  assert.equal(slug("Sony a7 III Full Frame Mirrorless Camera Body"), "sony-a7-iii");
  assert.equal(slug("Nikon Z6III Mirrorless Camera Body"), "nikon-z6-iii");
  assert.equal(slug("Nikon Z 6II body only"), "nikon-z6-ii");
  assert.equal(slug("Fujifilm X100VI Digital Camera Silver"), "fujifilm-x100vi");
  assert.equal(slug("Fujifilm X100V Digital Camera Black"), "fujifilm-x100v");
});

test("a letter suffix is a different camera", () => {
  assert.equal(slug("Sony a7R IV Mirrorless Camera"), "sony-a7r-iv");
  assert.equal(slug("Sony a7CR Mirrorless Camera Silver"), "sony-a7cr");
  assert.equal(slug("Sony a7C II Mirrorless Camera Body"), "sony-a7c-ii");
  assert.equal(slug("Sony a7C Mirrorless Camera Body"), "sony-a7c");
});

test("a trailing digit or focal length is not the model", () => {
  assert.equal(slug("Canon EOS R50 Mirrorless Camera"), "canon-eos-r50");
  assert.equal(slug("Canon EOS R5 Mirrorless Camera Body"), "canon-eos-r5");
  assert.equal(slug("Nikon NIKKOR Z 50mm f/1.8 S Lens"), "nikon-z-50mm-f1-8-s");
});

test("camera accessories and parts are refused", () => {
  assert.equal(slug("Battery Grip for Sony a7 IV"), null);
  assert.equal(slug("SmallRig Cage for Sony a7 IV"), null);
  assert.equal(slug("Screen Protector compatible with Canon R6 Mark II"), null);
  assert.equal(slug("Sony a7 III for parts not working"), null);
  assert.equal(slug("Sony (View Finder Doesn't Work) Sony a7 III Body"), null);
  assert.equal(slug("Sony a7 III - shutter does not work"), null);
  assert.equal(slug("Sony NP-FZ100 battery for a7 IV"), null);
});

test("parts pulled from a body or a lens are refused, but spec words in real titles are not", () => {
  assert.equal(slug("Sony A7 III ILCE-7M3 CMOS Image Sensor Unit Replacement Part"), null);
  assert.equal(slug("Sony Alpha a7 III CMOS Sensor Assembly"), null);
  assert.equal(slug("Canon EOS R5 Main Board Replacement"), null);
  assert.equal(slug("Sony A7 IV Rear LCD Display Replacement"), null);
  assert.equal(slug("Sony a7 III Shutter Assembly"), null);
  assert.equal(slug("Sony a7 III Eyepiece"), null);
  assert.equal(slug("Sony a7 III Untested"), null);
  assert.equal(slug("Sony FE 24-70mm F2.8 GM II Lens Front Element Glass Replacement"), null);
  assert.equal(slug("Sony Alpha a7 III 24.2MP Full Frame CMOS Mirrorless Digital Camera Body"), "sony-a7-iii");
  assert.equal(slug('Canon EOS R5 Full-Frame Mirrorless Camera, 45 Megapixel Full-Frame CMOS Sensor, 3.2" Vari-Angle LCD Display'), "canon-eos-r5");
});

test("action-camera mods are accessories, even when the mod shares the camera's name", () => {
  const gopro = buildIndex([
    cam("gopro-max", "gopro", ["GoPro MAX", "MAX 360"], { mount: null, type: "360", launchPriceUsd: 499.99 }),
    cam("gopro-hero13-black", "gopro", ["HERO13 Black"], { mount: null, type: "action", launchPriceUsd: 399.99 }),
  ]);
  const g = (title: string) => matchListing({ title }, gopro).product?.slug ?? null;
  assert.equal(g("GoPro MAX Lens Mod 2.0 for HERO13 Black"), null);
  assert.equal(g("GoPro HERO13 Black Macro Lens Mod"), null);
  assert.equal(g("GoPro HERO13 Black Media Mod"), null);
  assert.equal(g("GoPro MAX 360 Action Camera"), "gopro-max");
  assert.equal(g("GoPro HERO13 Black"), "gopro-hero13-black");
});

test("film cameras that share a digital name are refused", () => {
  assert.equal(slug("Sony a7 IV 35mm film SLR"), null);
  assert.equal(slug("Fujifilm X100V Digital Camera"), "fujifilm-x100v");
});

test("the brand must be named for a title match", () => {
  assert.equal(slug("R5 body excellent condition"), null);
});

test("two different cameras in one title is refused, not guessed", () => {
  assert.equal(slug("Sony a7 III and a7 IV bundle"), null);
});

test("GTIN and part number win over the title", () => {
  assert.equal(slug("Mirrorless camera", { gtin: "0027242923577" }), "sony-a7-iv");
  assert.equal(slug("Sony mirrorless camera", { mpn: "ILCE-7M3" }), "sony-a7-iii");
  assert.equal(slug("Sony mirrorless camera", { mpn: "ILCE-7M4/B" }), "sony-a7-iv");
  assert.equal(slug("Sony lens", { mpn: "SEL2470GM2" }), "sony-fe-24-70mm-f2-8-gm-ii");
  // Part numbers aren't unique across makers: the title must name the brand.
  assert.equal(slug("Mirrorless camera", { mpn: "ILCE-7M3" }), null);
});

test("a brand-prefixed alias doesn't hide the successor", () => {
  assert.equal(slug("Sony a7C II Body"), "sony-a7c-ii");
  assert.equal(slug("Sony a7C Body"), "sony-a7c");
});

test("a generation we don't list is refused, not read as the older model", () => {
  assert.equal(slug("Canon EOS R5 Mark II Body"), null);
  assert.equal(slug("Nikon Z50 II Mirrorless"), null);
  assert.equal(slug("Sony FE 24-70mm F2.8 GM III"), null);
  assert.equal(slug("Sony a6400 E Mount Camera"), null); // not in the fixtures: no alias
  assert.equal(slug("Nikon Z6 III 24.5MP"), "nikon-z6-iii");
});

test("a decimal aperture is one word, so 'GM 2.8' is not 'GM2'", () => {
  const gm = buildIndex([], [
    lensFix("sony-fe-24-70mm-f2-8-gm-ii", "sony", ["FE 24-70mm F2.8 GM II", "24-70 GM II", "24-70 GM2"]),
    lensFix("sony-fe-24-70mm-f2-8-gm", "sony", ["FE 24-70mm F2.8 GM", "FE 24-70 GM", "24-70 GM"], { launchPriceUsd: 2199 }),
    lensFix("hasselblad-xcd-2-5-90v", "hasselblad", ["XCD 2,5/90V", "XCD 2.5/90V"], { mounts: ["hasselblad-x"], launchPriceUsd: 4299 }),
  ]);
  const g = (title: string) => matchListing({ title }, gm).product?.slug ?? null;
  assert.equal(g("Sony FE 24-70 GM 2.8"), "sony-fe-24-70mm-f2-8-gm");
  assert.equal(g("Sony 24-70 GM2"), "sony-fe-24-70mm-f2-8-gm-ii");
  assert.equal(g("Sony FE 24-70mm F2.8 GM II Lens"), "sony-fe-24-70mm-f2-8-gm-ii");
  assert.equal(g("Hasselblad XCD 2.5/90V"), "hasselblad-xcd-2-5-90v");
  assert.equal(g("Hasselblad XCD 2,5/90V"), "hasselblad-xcd-2-5-90v");
  assert.equal(compact("FE 24-70mm F2.8 GM"), compact("fe 24-70mm f/2.8 gm"));
});

test("kits are flagged for interchangeable-lens bodies only", () => {
  const kit = matchListing({ title: "Sony a7 IV with 28-70mm Lens Kit" }, index);
  assert.ok(kit.product && kit.kit);
  const body = matchListing({ title: "Sony a7 IV Body Only" }, index);
  assert.ok(body.product && !body.kit);
  const fixed = matchListing({ title: "Fujifilm X100VI 23mm f/2 Silver" }, index);
  assert.ok(fixed.product && !fixed.kit);
});

test("a kit lens with its prefix glued on, or added with '+' to a body, is still a kit", () => {
  const kit = (title: string) => {
    const m = matchListing({ title }, index);
    return m.product ? m.kit : null;
  };
  assert.equal(kit("Canon EOS R50 Mirrorless Camera with RF-S18-45mm Lens"), true);
  assert.equal(kit("Canon EOS R5 Mirrorless Camera RF24-105mm"), true);
  assert.equal(kit("Sony a7 IV Body Only + Sigma 24mm"), true);
  assert.equal(kit("Sony a7 IV Body Only"), false);
  assert.equal(kit("Sony a7 IV Body, fits FE 24-70mm"), false);
});

test("lens generations and series never collide", () => {
  assert.equal(slug("Sony FE 24-70mm f/2.8 GM II Lens"), "sony-fe-24-70mm-f2-8-gm-ii");
  assert.equal(slug("Sony FE 24-70mm F2.8 G Master Lens SEL2470GM"), "sony-fe-24-70mm-f2-8-gm");
  assert.equal(slug("Sony 24-70mm F2.8 GM"), "sony-fe-24-70mm-f2-8-gm");
});

test("third-party lens versions: the mount is read from the title, and must be one the lens is made for", () => {
  const e = matchListing({ title: "Sigma 24-70mm F2.8 DG DN II Art Lens for Sony E" }, index);
  assert.ok(e.product && e.product.slug === "sigma-24-70mm-f2-8-dg-dn-art-ii" && e.mount === "sony-e");
  const l = matchListing({ title: "Sigma 24-70mm f/2.8 DG DN Art II L-Mount" }, index);
  assert.ok(l.product && l.mount === "l-mount");
  assert.equal(slug("Sigma 24-70mm F2.8 DG DN II Art for Nikon F"), null);
  const x = matchListing({ title: "Sigma 56mm f/1.4 DC DN Contemporary Lens for Fujifilm X" }, index);
  assert.ok(x.product && x.mount === "fujifilm-x");
  const efm = matchListing({ title: "Sigma 56mm F1.4 DC DN Contemporary for Canon EF-M" }, index);
  assert.ok(efm.product && efm.mount === "canon-ef-m");
});

test("a camera named after 'for' is a compatibility note on a lens listing", () => {
  const m = matchListing({ title: "Sigma 56mm f/1.4 DC DN Contemporary Lens for Sony E a6400" }, index);
  assert.ok(m.product && m.kind === "lens");
});

test("lens accessories are refused", () => {
  assert.equal(slug("ALC-SH167 Lens Hood for Sony FE 24-70mm F2.8 GM II"), null);
  assert.equal(slug("82mm UV Filter for Sony FE 24-70mm f/2.8 GM II"), null);
  // Named after the lens, with no "for".
  assert.equal(slug("Sony FE 24-70mm F2.8 GM II Lens Hood ALC-SH167"), null);
  assert.equal(slug("Sony FE 24-70mm F2.8 GM Front Lens Cap"), null);
  assert.equal(slug("Sigma 24-70mm F2.8 DG DN II Art Tripod Collar"), null);
  // …but a lens that comes with them is the lens.
  assert.equal(slug("Sony FE 24-70mm F2.8 GM II Lens w/ Hood & Caps"), "sony-fe-24-70mm-f2-8-gm-ii");
  assert.equal(slug("Sony FE 24-70mm F2.8 GM Lens with Front and Rear Caps"), "sony-fe-24-70mm-f2-8-gm");
});

test("a body with a lens is a camera kit, never a lens price", () => {
  const m = matchListing({ title: "Sony a7 IV with FE 24-70mm F2.8 GM II" }, index);
  assert.ok(m.product && m.kind === "camera" && m.kit);
  assert.equal(slug("Sony a7 IV with FE 24-70mm F2.8 GM II", {}, "lens"), null);
});

test("mountInTitle reads one mount or none", () => {
  assert.equal(mountInTitle("tamron 28-75mm di iii vxd g2 for nikon z"), "nikon-z");
  assert.equal(mountInTitle("canon ef-s 10-18mm"), "canon-ef");
  assert.equal(mountInTitle("sony fe 24-70 gm"), "sony-e");
  assert.equal(mountInTitle("panasonic lumix s 50mm"), null);
});

test("prices far below launch are refused, in any currency", () => {
  const a7iv = index.bySlug.get("sony-a7-iv")!;
  assert.equal(plausiblePrice(a7iv, "new", 2199), true);
  assert.equal(plausiblePrice(a7iv, "new", 400), false);
  assert.equal(plausiblePrice(a7iv, "used", 1400), true);
  assert.equal(plausiblePrice(a7iv, "used", 120), false);
  assert.equal(plausiblePrice(a7iv, "new", 1999, "GBP"), true);
  assert.equal(plausiblePrice(a7iv, "new", 350, "GBP"), false);
  assert.equal(plausiblePrice({ launchPriceUsd: 2499, launchPrices: { AUD: 4299 } }, "new", 3600, "AUD"), true);
});

test("with no US launch price, another market's sets the floor", () => {
  const gbpOnly = { launchPriceUsd: null, launchPrices: { GBP: 790 } };
  assert.equal(launchIn(gbpOnly, "GBP"), 790);
  assert.equal(Math.round(launchIn(gbpOnly, "USD")!), 1000);
  assert.equal(plausiblePrice(gbpOnly, "new", 120), false);
  assert.equal(plausiblePrice(gbpOnly, "new", 950), true);
});

test("with no launch price anywhere, only a GTIN or part-number match is trusted", () => {
  const none = { launchPriceUsd: null, launchPrices: {} };
  assert.equal(launchIn(none, "USD"), null);
  // "Canon EF 24-70mm f/2.8L II USM Lens Hood" at $45 is a title match.
  assert.equal(plausiblePrice(none, "new", 45), false);
  assert.equal(plausiblePrice(none, "used", 1200, "USD", "title"), false);
  assert.equal(plausiblePrice(none, "used", 1200, "USD", "gtin"), true);
  assert.equal(plausiblePrice(none, "new", 20, "USD", "mpn"), false);
});

test("bundles with a named lens are kits, not body prices", () => {
  const kit = matchListing({ title: "Sony a7 IV Bundle with Sony FE 28-70mm" }, index);
  assert.ok(kit.product && kit.kit);
  const named = matchListing({ title: "Sony a7 IV with Zeiss Batis Sonnar 85mm" }, index);
  assert.ok(named.product && named.kit);
});

// ---- kit lenses (feedback round 2026-10-22)
import { kitLensNames, kitLensOf } from "../src/lib/matching";

const KIT_LENSES = [
  ...LENSES,
  lensFix("canon-rf-s-18-45mm-f4-5-6-3-is-stm", "canon", ["RF-S 18-45mm F4.5-6.3 IS STM", "RF-S 18-45mm IS STM", "RF-S 18-45mm"], { mounts: ["canon-rf"], coverage: "aps-c", launchPriceUsd: 299 }, { focalMinMm: 18, focalMaxMm: 45, apertureMax: 4.5, apertureMaxTele: 6.3 }),
  lensFix("canon-rf-24-105mm-f4l-is-usm", "canon", ["RF 24-105mm F4L IS USM", "RF 24-105mm F4 L IS USM"], { mounts: ["canon-rf"], launchPriceUsd: 1099 }, { focalMinMm: 24, focalMaxMm: 105, apertureMax: 4 }),
  lensFix("canon-rf-24-105mm-f4-7-1-is-stm", "canon", ["RF 24-105mm F4-7.1 IS STM"], { mounts: ["canon-rf"], launchPriceUsd: 399 }, { focalMinMm: 24, focalMaxMm: 105, apertureMax: 4, apertureMaxTele: 7.1 }),
  lensFix("sony-fe-28-70mm-f3-5-5-6-oss", "sony", ["FE 28-70mm F3.5-5.6 OSS"], { launchPriceUsd: 399 }, { focalMinMm: 28, focalMaxMm: 70, apertureMax: 3.5, apertureMaxTele: 5.6 }),
];
const kIndex = buildIndex(CAMERAS, KIT_LENSES);
const kit = (title: string) => {
  const m = matchListing({ title }, kIndex);
  assert.ok(m.product && m.kind === "camera" && m.kit, `not a kit: ${title}`);
  return kitLensOf(title, kIndex, KIT_LENSES, m.product);
};

test("kit lens: the catalog lens by its alias, and the name as the listing gives it", () => {
  assert.deepEqual(kit("Canon EOS R50 with RF-S 18-45mm f/4.5-6.3 IS STM"), { kitLens: "canon-rf-s-18-45mm-f4-5-6-3-is-stm", kitLensName: "RF-S 18-45mm f/4.5-6.3 IS STM" });
  assert.deepEqual(kit("Sony a7 IV FE 28-70mm F3.5-5.6 OSS Kit"), { kitLens: "sony-fe-28-70mm-f3-5-5-6-oss", kitLensName: "FE 28-70mm F3.5-5.6 OSS" });
  // Shorthand: by focal range among the camera maker's lenses for its mount.
  assert.deepEqual(kit("Canon EOS R50 w/ 18-45mm"), { kitLens: "canon-rf-s-18-45mm-f4-5-6-3-is-stm", kitLensName: "18-45mm" });
  assert.deepEqual(kit("CANON EOS R50 WITH RF-S 18-45MM LENS"), { kitLens: "canon-rf-s-18-45mm-f4-5-6-3-is-stm", kitLensName: "RF-S 18-45MM" });
});

test("kit lens: ambiguous or twin kits keep the name and refuse the slug", () => {
  // Two Canon RF 24-105mm lenses start at f/4: the range alone can't say which.
  assert.deepEqual(kit("Canon EOS R5 w/ 24-105mm Kit"), { kitLens: null, kitLensName: "24-105mm" });
  // …but the aperture can.
  assert.equal(kit("Canon EOS R5 w/ 24-105mm f/4-7.1 Kit").kitLens, "canon-rf-24-105mm-f4-7-1-is-stm");
  assert.deepEqual(kit("Canon EOS R50 Twin Lens Kit 18-45mm & 55-210mm"), { kitLens: null, kitLensName: "18-45mm + 55-210mm" });
  // A kit with no focal length named: neither.
  assert.deepEqual(kit("Sony a7 IV Single Lens Kit"), { kitLens: null, kitLensName: null });
  // A lens for another mount is never the kit lens.
  assert.equal(kit("Sony a7 IV with 18-45mm Kit").kitLens, null);
  assert.deepEqual(kitLensNames("Fujifilm X-T5 Black w/ XF16-80mmF4 R OIS WR"), ["XF16-80mmF4 R OIS WR"]);
});

test("kit lens helpers change no match: the same listings match as before", () => {
  for (const t of ["Canon EOS R50 with RF-S 18-45mm f/4.5-6.3 IS STM", "Canon EOS R50 w/ 18-45mm", "Sony a7 IV FE 28-70mm F3.5-5.6 OSS Kit"]) {
    assert.equal(matchListing({ title: t }, index).product?.slug, matchListing({ title: t }, kIndex).product?.slug, t);
  }
});

test("a model number with a letter after the name is a model we don't list (Osmo Pocket 4P)", () => {
  const dji = [cam("dji-osmo-pocket", "dji", ["Osmo Pocket"], { mount: null, type: "compact", launchPriceUsd: 349 }), cam("dji-osmo-pocket-3", "dji", ["Osmo Pocket 3", "Pocket 3"], { mount: null, type: "compact", launchPriceUsd: 519 })];
  const di = buildIndex([...CAMERAS, ...dji], LENSES);
  const s = (t: string) => matchListing({ title: t }, di).product?.slug ?? null;
  assert.equal(s("DJI Osmo Pocket 4P"), null);
  assert.equal(s("DJI Osmo Pocket 4P Creator Combo"), null);
  assert.equal(s("DJI Osmo Pocket 4"), null);
  assert.equal(s("DJI Osmo Pocket 3 Creator Combo"), "dji-osmo-pocket-3");
  assert.equal(s("DJI Osmo Pocket"), "dji-osmo-pocket");
  // A resolution after the name is not a model.
  assert.equal(slug("Canon EOS R5 8K Mirrorless Body"), "canon-eos-r5");
  assert.equal(slug("Sony a7 IV 4K Body"), "sony-a7-iv");
});
