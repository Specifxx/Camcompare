import assert from "node:assert/strict";
import { test } from "node:test";
import { accessoryOffer, capAccessories, capacityOf, classifyAccessory, mergeAccessories, perGbHistory, speedOf, type AccessoryOffer } from "../src/lib/accessories";
import { buildIndex, matchListing } from "../src/lib/matching";
import { CAMERAS, LENSES } from "./fixtures";

const index = buildIndex(CAMERAS, LENSES);
const c = (title: string, productType?: string) => classifyAccessory({ title, productType }, index);
const cat = (title: string, productType?: string) => c(title, productType)?.category ?? null;
const NOW = "2026-10-17T07:00:00.000Z";

test("categories from real-looking titles", () => {
  assert.equal(cat("SmallRig Cage for Sony a7 IV 3667"), "cages");
  assert.equal(cat("Peak Design Travel Tripod Aluminum"), "tripods");
  assert.equal(cat("Kodak Portra 400 35mm 36exp"), "film");
  assert.equal(cat("Ilford HP5 Plus 400 120 Black and White Film"), "film");
  assert.equal(cat("Polaroid Originals Color Instant Film for 600 Cameras (8 Exposures)"), "film");
  assert.equal(cat("Sony NP-FZ100 Battery"), "batteries");
  assert.equal(cat("Canon LP-E6NH Battery Pack"), "batteries");
  assert.equal(cat("Canon NB6LH"), "batteries");
  assert.equal(cat("Pentax Battery Grip D-BG8 (Black)"), "grips");
  assert.equal(cat("Sony VG-C4EM Vertical Grip for a7 IV"), "grips");
  assert.equal(cat("Leofoto LPS-A7IV L-Bracket for Sony a7 IV"), "plates");
  assert.equal(cat("Manfrotto XPRO Monopod+ 4-Section"), "monopods");
  assert.equal(cat("DJI RS 4 Gimbal Stabilizer"), "gimbals");
  assert.equal(cat("Peak Design Slide Lite Camera Strap Black"), "straps");
  assert.equal(cat("Shimoda Designs Urban Explore Backpack (Boa, 30L)"), "bags");
  assert.equal(cat("NiSi 82mm True Color Variable ND Filter"), "filters");
  assert.equal(cat("Tiffen 62mm Variable ND Filter (Open Box)"), "filters");
  assert.equal(cat("SanDisk 128GB Extreme PRO SDXC UHS-I Card 200MB/s"), "memory-cards");
  assert.equal(cat("Rode VideoMic NTG On-Camera Shotgun Microphone"), "microphones");
  assert.equal(cat("Godox V1-S Round Head Flash for Sony"), "flashes");
  assert.equal(cat("Godox AD200Pro TTL Pocket Flash"), "strobes");
  assert.equal(cat("Godox X2T-C TTL Wireless Flash Trigger for Canon"), "triggers");
  assert.equal(cat("Westcott FJ400-SE 2-Light Studio Strobe Kit with FJ-X3 S Wireless Trigger (Sony)"), "strobes");
  assert.equal(cat("Aputure Amaran 200x S Bi-Color LED Light"), "led-lights");
  assert.equal(cat("Westcott Rapid Box Switch Octa Softbox (36 inch)"), "modifiers");
  assert.equal(cat("Sony RMT-P1BT Wireless Remote Commander"), "remotes");
  assert.equal(cat("Brandess 77mm Snap Cap"), "caps-hoods");
  assert.equal(cat("Metabones Canon EF to Sony E Mount T Smart Adapter"), "adapters");
  assert.equal(cat("VSGO Sensor Cleaning Swab Kit Full Frame"), "cleaning");
  assert.equal(cat("Atomos Ninja V 5\" 4K HDMI Recording Monitor"), "monitors");
  assert.equal(cat("Samsung T7 Shield 2TB Portable SSD USB 3.2 Gen 2"), "storage");
  assert.equal(cat("SmallRig Ultra Slim 4K HDMI Cable (Micro HDMI to HDMI) 55cm"), "cables");
  assert.equal(cat("Expert Shield Screen Protector for Sony a7 IV"), "screen-protectors");
  assert.equal(cat("Nitecore USN3 Pro for Sony SLR", "DIGITAL CHARGERS"), "chargers");
});

test("not accessories: cameras, lenses, bundles and other shop stock", () => {
  assert.equal(cat("Sony a7 IV Mirrorless Camera Body with Extra Battery"), null);
  assert.equal(cat("OM SYSTEM Olympus Tough TG-7 12MP Underwater Camera Black + Guide & 128GB Bundle"), null);
  assert.equal(cat("Nikon Z 24-70mm f2.8 S, Hood 20101714"), null);
  assert.equal(cat("Canon AE-1 Program 35mm Film Camera"), null);
  assert.equal(cat("Leica Geovid Pro 8x56mm Rangefinding Binocular"), null);
  assert.equal(cat("Knives of Alaska Light Hunter D2 Blade with Leather Sheath"), null);
  assert.equal(cat("Canon PGI-72 Photo Magenta"), null);
  assert.equal(cat("Leica M6 Original Style Battery Cover"), null);
  assert.equal(cat("Expert Shield Screen Protector Film for Fujifilm X100V"), "screen-protectors");
  assert.equal(cat("Battery grip for parts, not working"), null);
});

test("brands: the maker, never the camera named after 'for'", () => {
  assert.equal(c("SmallRig Cage for Sony a7 IV 3667")?.brand, "smallrig");
  assert.equal(c("Sony NP-FZ100 Battery")?.brand, "sony");
  assert.equal(c("Cage for Sony a7 IV")?.brand, null);
  assert.equal(c("K&F Concept 77mm ND1000 Filter")?.brand, "kf-concept");
  assert.equal(c("B+W 67mm XS-Pro UV MRC Nano Filter")?.brand, "b-w");
  assert.equal(c("Fujifilm Instax Mini Film Twin Pack")?.brand, "fujifilm");
  assert.equal(c("Think Tank Photo Airport Security V3.0 Rolling Case")?.brand, "think-tank");
});

test("cameras: named with their brand, newest generation never read as an older one", () => {
  assert.deepEqual(c("SmallRig Cage for Sony a7 IV 3667")?.cameras, ["sony-a7-iv"]);
  assert.deepEqual(c("SmallRig Cage for Sony Alpha 7 IV / a7 III")?.cameras, ["sony-a7-iv", "sony-a7-iii"]);
  assert.deepEqual(c("Leofoto L-Bracket for Canon R6 Mark II")?.cameras, ["canon-eos-r6-mark-ii"]);
  assert.deepEqual(c("Leofoto L-Bracket for Canon R6 Mark III")?.cameras, []);
  assert.deepEqual(c("Cage for a7 IV")?.cameras, []); // no brand named
  assert.deepEqual(c("Sony VG-C4EM Vertical Grip for a7 IV")?.cameras, ["sony-a7-iv"]); // the maker is the brand
  assert.deepEqual(c("Kodak Portra 400 35mm 36exp")?.cameras, []);
  assert.deepEqual(c("Peak Design Travel Tripod Aluminum")?.cameras, []);
  assert.deepEqual(c("SmallRig Cage for Sony a7 IV 3667")?.cameraBrands, ["sony"]);
});

test("matchListing still refuses these as camera offers; the classifier only adds", () => {
  for (const t of ["SmallRig Cage for Sony a7 IV 3667", "Sony a7 IV Battery Grip VG-C4EM", "Expert Shield Screen Protector for Sony a7 IV"]) assert.equal(matchListing({ title: t }, index).product, null, t);
});

test("flash and trigger systems", () => {
  assert.deepEqual(c("Godox V1-S Round Head Flash")?.cameraBrands, ["sony"]);
  assert.deepEqual(c("Godox X2T-N TTL Wireless Flash Trigger")?.cameraBrands, ["nikon"]);
  assert.deepEqual(c("Godox XPro-F TTL Wireless Flash Trigger")?.cameraBrands, ["fujifilm"]);
  assert.deepEqual(c("Profoto A10 Flash for Canon")?.cameraBrands, ["canon"]);
  assert.deepEqual(c("Canon Speedlite EL-5")?.cameraBrands, ["canon"]);
  assert.deepEqual(c("Nikon SB-5000 AF Speedlight")?.cameraBrands, ["nikon"]);
  assert.deepEqual(c("Godox TT685II-O Flash for Olympus/Panasonic")?.cameraBrands, ["om-system", "panasonic"]);
});

test("memory cards: format, capacity, speed", () => {
  const s = (t: string) => c(t)?.specs;
  assert.deepEqual(s("SanDisk 128GB Extreme PRO SDXC UHS-I Card 200MB/s V30"), { format: "sd", capacityGB: 128, readMBs: 200, vClass: 30, uhs: "UHS-I" });
  assert.equal(s("ProGrade Digital 512GB CFexpress Type B Gold 1700/1500MB/s")?.format, "cfexpress-b");
  assert.deepEqual([s("ProGrade Digital 512GB CFexpress Type B Gold 1700/1500MB/s")?.readMBs, s("ProGrade Digital 512GB CFexpress Type B Gold 1700/1500MB/s")?.writeMBs], [1700, 1500]);
  assert.equal(s("Sony 160GB CFexpress Type A TOUGH Card VPG400")?.format, "cfexpress-a");
  assert.equal(s("Sony 160GB CFexpress Type A TOUGH Card VPG400")?.vpg, 400);
  assert.equal(s("Lexar 1TB Professional CFexpress 4.0 Type B Diamond")?.capacityGB, 1000);
  assert.equal(s("Samsung PRO Plus 256GB microSDXC UHS-I U3 V30")?.format, "microsd");
  assert.equal(s("Sony 120GB G Series XQD Card")?.format, "xqd");
  assert.equal(s("Angelbird AV PRO CFast 2.0 256GB")?.format, "cfast");
  assert.deepEqual(capacityOf("sandisk 64gb extreme sdxc 2-pack"), { capacityGB: 128, pack: 2 });
  assert.deepEqual(capacityOf("lexar 512gb (2 x 256gb) sd"), { capacityGB: 512, pack: 2 });
  assert.deepEqual(speedOf("up to 300mb/s read, 260mb/s write"), { readMBs: 300, writeMBs: 260 });
  assert.equal(s("Sony SF-G Tough 128GB UHS-II SDXC")?.uhs, "UHS-II");
});

test("storage and cables", () => {
  const s = (t: string) => c(t)?.specs;
  assert.deepEqual(s("Samsung T7 Shield 2TB Portable SSD USB 3.2 Gen 2 1050MB/s"), { format: "portable-ssd", capacityGB: 2000, readMBs: 1050 });
  assert.equal(s("Samsung 990 PRO 2TB NVMe M.2 SSD")?.format, "nvme");
  assert.equal(s("WD 5TB My Passport Portable Hard Drive")?.format, "hdd");
  assert.equal(s("ProGrade Digital CFexpress Type B Card Reader USB-C")?.format, "card-reader");
  assert.equal(c("ProGrade Digital CFexpress Type B Card Reader USB-C")?.category, "storage");
  assert.deepEqual(s("SmallRig Ultra Slim 4K HDMI Cable (Micro HDMI to HDMI) 55cm"), { format: "hdmi", hdmi: "Micro HDMI to HDMI", lengthM: 0.55 });
  assert.equal(s("Ulanzi 8K HDMI 2.1 Cable 1m")?.hdmiVersion, "2.1");
  assert.deepEqual(s("Anker Thunderbolt 4 Cable 0.7m 100W"), { format: "thunderbolt", usb: "Thunderbolt 4", gbps: 40, watts: 100, lengthM: 0.7 });
  assert.equal(s("Tether Tools USB-C to USB-C USB 3.2 Gen 2 Cable 15ft")?.gbps, 10);
  assert.equal(s("Tether Tools USB-C to USB-C USB 3.2 Gen 2 Cable 15ft")?.lengthM, 4.57);
});

const ao = (o: Partial<AccessoryOffer>): AccessoryOffer => ({
  title: "x", category: "batteries", brand: null, cameras: [], cameraBrands: [], specs: {}, retailer: "focus-camera", condition: "new", price: 5000, currency: "USD", url: "https://focuscamera.com/products/x", inStock: true, seenAt: NOW, sourceId: null, ...o,
});

test("offers: price guards refuse a camera sold with an accessory, and absurd prices", () => {
  const base = { productType: null, vendor: null, currency: "USD" as const, url: "https://focuscamera.com/products/x", inStock: true, condition: "new" as const, sourceId: null };
  assert.equal(accessoryOffer({ ...base, title: "Sony a7 IV Battery Grip VG-C4EM", price: 39900 }, index, "focus-camera", NOW)?.cameras[0], "sony-a7-iv");
  assert.equal(accessoryOffer({ ...base, title: "Sony a7 IV Battery Grip Bundle Kit", price: 219900 }, index, "focus-camera", NOW), null);
  assert.equal(accessoryOffer({ ...base, title: "Brandess 77mm Snap Cap", price: 99900 }, index, "focus-camera", NOW), null);
  assert.equal(accessoryOffer({ ...base, title: "Brandess 77mm Snap Cap", price: 1695 }, index, "focus-camera", NOW)?.category, "caps-hoods");
});

test("merge keeps a failed retailer's rows until stale, caps per category and camera", () => {
  const old = ao({ retailer: "beach-camera", seenAt: "2026-10-12T00:00:00.000Z" });
  const kept = ao({ retailer: "beach-camera", url: "https://www.beachcamera.com/products/y" });
  const out = mergeAccessories([old, kept], { "beach-camera": { status: "error" }, "focus-camera": { status: "ok", accessories: [ao({})] } }, NOW, 72, () => true);
  assert.equal(out.length, 2);
  const many = Array.from({ length: 450 }, (_, i) => ao({ url: `https://focuscamera.com/products/${i}`, price: 1000 + i, cameras: i >= 440 ? ["sony-a7-iv"] : [] }));
  const capped = capAccessories(many);
  assert.equal(capped.length, 310); // 300 cheapest + the 10 for the a7 IV
});

test("price-per-GB history: lowest per format and capacity", () => {
  const rows = perGbHistory([
    ao({ category: "memory-cards", specs: { format: "sd", capacityGB: 128 }, price: 2000 }),
    ao({ category: "memory-cards", specs: { format: "sd", capacityGB: 128 }, price: 1800 }),
    ao({ category: "memory-cards", specs: { format: "sd", capacityGB: 128 }, price: 900, inStock: false }),
  ]);
  assert.deepEqual(rows, [{ category: "memory-cards", format: "sd", capacityGB: 128, lowest: 1800, lowestPerGB: 14.06 }]);
});

test("spot-check fixes from the first import", () => {
  assert.equal(cat("Leica Battery Charger BC-SCL7 for M11"), "chargers");
  assert.equal(cat("Godox S-Type Speedlite Bracket (Bowens)"), "modifiers");
  assert.equal(cat("Sony BDP-S1700 Blu-Ray Disc Player Bundle with HDMI Cable"), null);
  assert.equal(cat("Spypoint 128GB Micro-SD Card for Trail Cameras"), null);
  assert.equal(c("Lexar 128GB Micro-SD Card UHS-I")?.specs.format, "microsd");
  assert.equal(c("Atomos Right angle MICRO to FULL HDMI Cable (50cm)")?.specs.hdmi, "Micro HDMI to HDMI");
  assert.deepEqual(c("Canon Mount Adapter EF-EOS R")?.cameras, []);
});

test("thousands separators and zero speeds never reach the file", () => {
  const s = c("Samsung 990 EVO 5.0 NVMe SSD 1TB: Ultra-Fast 5,000MB/s Read")?.specs;
  assert.equal(s?.readMBs, 5000);
  assert.equal(c("Some 0/0MB/s SD Card 64GB")?.specs.readMBs, undefined);
});

test("flash parts are not flashes or triggers", () => {
  assert.notEqual(cat("Sony FAEC1AM 5' Flash Synchro Extension Cable"), "flashes");
  assert.notEqual(cat("ProMaster Dedicated Flash Diffuser for Nikon SB900"), "flashes");
  assert.notEqual(cat("Leica S2 Pocket Wizard Motor Drive Cable"), "triggers");
  assert.equal(cat("Godox V1-S Round Head Flash for Sony"), "flashes");
  assert.equal(cat("Profoto Connect - Canon"), "triggers");
});

test("a flash sold with its battery is still a flash", () => {
  assert.equal(cat("Godox V1-C Flash with VB26 Battery for Canon"), "flashes");
});
