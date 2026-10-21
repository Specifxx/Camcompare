// "Things to know" on a product page: short, factual bullets built from the
// catalog's spec-sheet facts and today's offers, plus "Good for / Not for"
// from fixed spec thresholds. Nothing is invented: a null spec produces no
// bullet, and every good-for/not-for line names the spec behind it.
// Server-only (reads the catalog for family names).
import { displayShortName, product, publishedCameras, publishedLenses } from "./catalog";
import type { Camera, Lens } from "./catalog/schema";
import { price } from "./format";
import type { Currency, MarketCode } from "./markets";
import type { Offer } from "./offers";
import { kitLensLabel, lowestKit } from "./price-rules";
import { num, sensorLabel } from "./specs/definitions";
import { apertureLabel, coverageLabel, cropFactor, equivalentLabel, focalLabel, isZoom } from "./specs/lens";
import type { UsedValue } from "./value";

export type Fit = { label: string; why: string };
export type ThingsToKnow = { facts: string[]; goodFor: Fit[]; notFor: Fit[] };

/** "Full frame" reads "full-frame" mid-sentence; "APS-C" and '1"' stay as they are. */
const sensorWord = (f: Camera["specs"]["sensorFormat"]) => (f === "full-frame" ? "full-frame" : f === "medium-format" ? "medium-format" : sensorLabel(f));
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const SUBJECT: Record<string, string> = { human: "people", animal: "animals", bird: "birds", vehicle: "vehicles", aircraft: "aircraft", train: "trains", insect: "insects" };
const SCREEN: Record<Camera["specs"]["screenType"], string | null> = { "fully-articulating": "fully articulating", tilting: "tilting", "multi-angle": "multi-angle", "flip-up": "flip-up", fixed: "fixed", none: null };

/**
 * Same-line siblings: the same brand and kind, where one's short name is the
 * other's plus words ("EOS R50" and "EOS R50 V", "Z50" and "Z50 II"). Not the
 * product itself, its predecessor or successor.
 */
export function lineSiblings(p: Camera | Lens, kind: "camera" | "lens", max = 3): (Camera | Lens)[] {
  const pool: (Camera | Lens)[] = kind === "camera" ? publishedCameras() : publishedLenses();
  const words = (s: string) => s.toLowerCase().split(/\s+/);
  const me = words(p.shortName);
  const prefix = (a: string[], b: string[]) => a.length < b.length && a.every((w, i) => w === b[i]);
  return pool
    .filter((x) => x.slug !== p.slug && x.slug !== p.predecessor && x.slug !== p.successor && x.brand === p.brand)
    .filter((x) => (kind === "camera" ? (x as Camera).type === (p as Camera).type : true))
    .filter((x) => {
      const w = words(x.shortName);
      return prefix(me, w) || prefix(w, me);
    })
    .sort((a, b) => b.announced.localeCompare(a.announced))
    .slice(0, max);
}

function family(p: Camera | Lens, kind: "camera" | "lens", m: MarketCode): string[] {
  const out: string[] = [];
  const name = (slug: string) => {
    const x = product(slug);
    return x ? `${displayShortName(x.item, m)} (${x.item.announced.slice(0, 4)})` : null;
  };
  const succ = p.successor ? name(p.successor) : null;
  const pred = p.predecessor ? name(p.predecessor) : null;
  if (succ) out.push(`Replaced by the ${succ}${p.status === "current" ? "; both are still sold" : ""}.`);
  if (pred) out.push(`Replaces the ${pred}.`);
  const sib = lineSiblings(p, kind).map((x) => `${displayShortName(x, m)} (${x.announced.slice(0, 4)})`);
  if (sib.length) out.push(`Same line: ${list(sib)}.`);
  if (p.status === "discontinued") out.push("Discontinued by the maker: new stock may be limited.");
  return out;
}

/** New kits on sale in this market, cheapest per lens, from today's offers. */
function kitsLine(offers: Offer[], currency: Currency, marketName: string): string | null {
  const byLens = new Map<string, number>();
  for (const o of offers) {
    if (!o.kit || !o.inStock || o.condition !== "new") continue;
    const l = kitLensLabel(o);
    if (!l) continue;
    const had = byLens.get(l);
    if (had === undefined || o.price < had) byLens.set(l, o.price);
  }
  const kits = [...byLens.entries()].sort((a, b) => a[1] - b[1]).slice(0, 3);
  if (!kits.length) return lowestKit(offers) ? `Also sold in kits with a lens in ${marketName}: see the Kits filter above. A kit price is never the body price.` : null;
  return `New kits on sale in ${marketName}: ${list(kits.map(([l, p]) => `with ${l} (from ${price(p, currency)})`))}. A kit price is never the body price.`;
}

function usedLine(used: UsedValue | null, todayUsed: number | null, currency: Currency, marketName: string): string {
  if (used) return `Used, it typically sells for about ${price(used.value, currency)} in ${marketName} (asking prices over ${used.days} days)${todayUsed !== null ? `; today from ${price(todayUsed, currency)}` : ""}.`;
  if (todayUsed !== null) return `Used from ${price(todayUsed, currency)} today in ${marketName}, at the stores we track.`;
  return `No used body-only listings at the stores we track in ${marketName} today: check eBay and the Used filter.`;
}

export type KnowInput = { offers: Offer[]; currency: Currency; market: MarketCode; marketName: string; used: UsedValue | null; todayUsed: number | null };

export function cameraThings(c: Camera, x: KnowInput): ThingsToKnow {
  const s = c.specs;
  const facts: string[] = [];
  const ibis = s.ibis === true ? `, with in-body stabilisation${s.ibisStops ? ` rated to ${num(s.ibisStops)} stops` : ""}` : s.ibis === false ? `; no in-body stabilisation, so steadiness comes from ${c.mount ? "stabilised lenses" : "the lens"}` : "";
  facts.push(`${num(s.megapixels)} MP ${sensorWord(s.sensorFormat)} ${s.sensorType ?? ""} sensor${ibis}.`.replace(/\s+/g, " "));
  if (s.afSubjects?.length) facts.push(`Autofocus recognises ${list(s.afSubjects.map((a) => SUBJECT[a] ?? a))}${s.afPoints ? ` (${num(s.afPoints)} AF points)` : ""}.`);
  else if (s.afPoints) facts.push(`${num(s.afPoints)} autofocus points.`);
  if (s.videoMaxRes) {
    const bits = [s.videoMaxRes === "4K" && s.video4kMaxFps ? `4K up to ${num(s.video4kMaxFps)}p` : `up to ${s.videoMaxRes}${s.video4kMaxFps ? ` (4K up to ${num(s.video4kMaxFps)}p)` : ""}`, s.video10bit ? "10-bit internal" : null, s.rawVideoInternal ? "internal raw" : null].filter(Boolean);
    const audio = s.micJack === null ? null : s.micJack ? (s.headphoneJack === false ? "a mic input but no headphone jack" : s.headphoneJack ? "mic and headphone jacks" : "a mic input") : "no mic input";
    facts.push(`Video ${bits.join(", ")}${audio ? `; ${audio}` : ""}.`);
  }
  const screen = s.screenType !== "none" && s.screenSizeIn ? `${num(s.screenSizeIn)}-inch ${SCREEN[s.screenType] ?? ""}${s.touchscreen ? " touchscreen" : " screen"}` : null;
  const vf = s.viewfinderType === "none" ? "no viewfinder" : s.evfDotsM && s.viewfinderType !== "optical" ? `${num(s.evfDotsM, "M", 2)}-dot ${s.viewfinderType === "hybrid" ? "hybrid" : "electronic"} viewfinder` : `${s.viewfinderType} viewfinder`;
  facts.push(`${[screen, vf].filter(Boolean).join("; ")}.`.replace(/^./, (ch) => ch.toUpperCase()));
  const power = [s.batteryShotsCipa ? `rated for ${num(s.batteryShotsCipa)} shots per charge (CIPA)` : null, s.usbC ? "USB-C port" : null].filter(Boolean);
  if (power.length) facts.push(`${power.join("; ")}.`.replace(/^./, (ch) => ch.toUpperCase()));
  const body = [s.weightG ? `${num(s.weightG)} g with battery and card` : null, s.dimensionsMm ? `${s.dimensionsMm.map((d) => Math.round(d)).join(" × ")} mm` : null, s.weatherSealed === null ? null : s.weatherSealed ? "weather sealed" : "not weather sealed"].filter(Boolean);
  if (body.length) facts.push(`${body.join("; ")}.`.replace(/^./, (ch) => ch.toUpperCase()));
  if (s.cardSlots !== null && s.cardSlots > 0) facts.push(`${s.cardSlots === 1 ? "One card slot" : `${s.cardSlots} card slots`}${s.cardTypes ? ` (${s.cardTypes})` : ""}.`);
  if (c.mount) {
    const k = kitsLine(x.offers, x.currency, x.marketName);
    if (k) facts.push(k);
  }
  facts.push(...family(c, "camera", x.market));
  facts.push(usedLine(x.used, x.todayUsed, x.currency, x.marketName));

  const burst = Math.max(s.burstMechFps ?? 0, s.burstElecFps ?? 0) || null;
  const goodFor: Fit[] = [];
  const notFor: Fit[] = [];
  const flip = s.screenType === "fully-articulating" || s.screenType === "flip-up" || s.screenType === "multi-angle";
  if (flip && s.micJack) goodFor.push({ label: "Vlogging and selfies", why: `${SCREEN[s.screenType]} screen and a mic input` });
  if (s.weightG && s.weightG <= 500) goodFor.push({ label: "Travel and everyday carry", why: `${num(s.weightG)} g` });
  if (s.videoMaxRes && s.video10bit) goodFor.push({ label: "Video", why: `${s.videoMaxRes === "4K" && s.video4kMaxFps ? `4K ${num(s.video4kMaxFps)}p` : s.videoMaxRes}, 10-bit internal` });
  if (burst && burst >= 15 && s.afSubjects?.some((a) => a !== "human")) goodFor.push({ label: "Wildlife and sport", why: `${num(burst)} fps bursts, ${list(s.afSubjects.filter((a) => a !== "human").map((a) => SUBJECT[a] ?? a))} detection` });
  if (s.sensorFormat === "full-frame" || s.sensorFormat === "medium-format") goodFor.push({ label: "Low light", why: `${sensorWord(s.sensorFormat)} sensor` });
  if (s.megapixels >= 40) goodFor.push({ label: "Landscape and detail", why: `${num(s.megapixels)} MP` });
  if (s.weatherSealed) goodFor.push({ label: "Bad weather", why: "weather sealed" });
  if (s.waterproofM) goodFor.push({ label: "Water and adventure", why: `waterproof to ${num(s.waterproofM)} m` });

  if (s.weatherSealed === false && !s.waterproofM) notFor.push({ label: "Rain and dust", why: "not weather sealed" });
  if (s.ibis === false && c.mount) notFor.push({ label: "Slow handheld shots with unstabilised lenses", why: "no in-body stabilisation" });
  if (s.batteryShotsCipa && s.batteryShotsCipa < 400) notFor.push({ label: "All-day shooting on one battery", why: `${num(s.batteryShotsCipa)} shots per charge (CIPA)` });
  if (s.cardSlots === 1) notFor.push({ label: "Paid jobs that need a backup card", why: "one card slot" });
  if (burst !== null && burst < 8) notFor.push({ label: "Fast action", why: `${num(burst)} fps` });
  if (s.micJack && s.headphoneJack === false) notFor.push({ label: "Monitoring sound while you film", why: "no headphone jack" });
  if (s.viewfinderType === "none") notFor.push({ label: "Eye-level shooting in bright sun", why: "no viewfinder" });
  return { facts, goodFor: goodFor.slice(0, 4), notFor: notFor.slice(0, 4) };
}

export function lensThings(l: Lens, x: KnowInput): ThingsToKnow {
  const s = l.specs;
  const k = cropFactor(l);
  const zoom = isZoom(l);
  const facts: string[] = [];
  const eq = equivalentLabel(l);
  facts.push(`${focalLabel(l)} ${zoom ? "zoom" : "prime"}, ${apertureLabel(l)}${zoom ? (s.apertureMaxTele ? " (the widest aperture narrows as you zoom)" : " constant through the zoom") : ""}${eq ? `; ${eq}` : ""}.`);
  facts.push(l.coverage === "aps-c" ? `APS-C lens: on a full-frame body of the same mount it crops the frame.` : `${coverageLabel(l.coverage)} lens${l.coverage === "full-frame" ? "; it also fits the mount's APS-C bodies" : ""}.`);
  const af = [s.autofocus ? (s.afMotor ? `autofocus (${s.afMotor} motor)` : "autofocus") : "manual focus only", s.stabilized === null ? null : s.stabilized ? "optical stabilisation" : "no optical stabilisation"].filter(Boolean);
  facts.push(`${af.join("; ")}.`.replace(/^./, (ch) => ch.toUpperCase()));
  const size = [s.weightG ? `${num(s.weightG)} g` : null, s.diameterMm && s.lengthMm ? `${num(s.diameterMm)} × ${num(s.lengthMm)} mm` : null, s.filterMm ? `${num(s.filterMm)}mm filters` : null, zoom && s.internalZoom !== null ? (s.internalZoom ? "internal zoom (doesn't extend)" : "extends as it zooms") : null].filter(Boolean);
  if (size.length) facts.push(`${size.join("; ")}.`.replace(/^./, (ch) => ch.toUpperCase()));
  if (s.minFocusM || s.maxMagnification) facts.push(`Focuses ${s.minFocusM ? `down to ${num(s.minFocusM, " m", 2)}` : "close"}${s.maxMagnification ? `, up to ${num(s.maxMagnification, "×", 2)} magnification` : ""}.`);
  if (s.weatherSealed !== null) facts.push(s.weatherSealed ? "Weather sealed." : "Not weather sealed.");
  if (l.mounts.length > 1) facts.push(`Made in ${l.mounts.length} mount versions: check the version before you buy.`);
  facts.push(...family(l, "lens", x.market));
  facts.push(usedLine(x.used, x.todayUsed, x.currency, x.marketName));

  const eqMin = s.focalMinMm * k;
  const eqMax = s.focalMaxMm * k;
  const goodFor: Fit[] = [];
  const notFor: Fit[] = [];
  if (eqMax >= 70 && eqMin <= 135 && s.apertureMax <= 2.8 && (eqMin >= 50 || zoom)) goodFor.push({ label: "Portraits", why: `${Math.round(Math.max(eqMin, 70))}–${Math.round(Math.min(eqMax, 135))}mm-equivalent reach at ${apertureLabel(l)}` });
  if (eqMin <= 24) goodFor.push({ label: "Landscapes and interiors", why: `${Math.round(eqMin)}mm-equivalent wide end` });
  if (eqMax >= 300) goodFor.push({ label: "Wildlife and sport", why: `${Math.round(eqMax)}mm-equivalent reach` });
  if (s.maxMagnification && s.maxMagnification >= 1) goodFor.push({ label: "Macro", why: `${num(s.maxMagnification, "×", 2)} magnification` });
  if (s.apertureMax <= 1.8) goodFor.push({ label: "Low light", why: `f/${s.apertureMax}` });
  if ((zoom && s.focalMaxMm / s.focalMinMm >= 4) || (s.weightG && s.weightG <= 250)) goodFor.push({ label: "Travel", why: zoom && s.focalMaxMm / s.focalMinMm >= 4 ? `${num(s.focalMaxMm / s.focalMinMm)}× zoom range` : `${num(s.weightG)} g` });
  if (s.weatherSealed === false) notFor.push({ label: "Rain and dust", why: "not weather sealed" });
  if (s.apertureMax >= 4) notFor.push({ label: "Low light without a tripod", why: `f/${s.apertureMax} at its widest${s.stabilized ? ", though it is stabilised" : ""}` });
  if (s.weightG && s.weightG >= 1000) notFor.push({ label: "Travelling light", why: `${num(s.weightG)} g` });
  if (!s.autofocus) notFor.push({ label: "Fast-moving subjects", why: "manual focus only" });
  if (s.maxMagnification && s.maxMagnification < 0.15) notFor.push({ label: "Close-ups", why: `${num(s.maxMagnification, "×", 2)} magnification` });
  return { facts, goodFor: goodFor.slice(0, 4), notFor: notFor.slice(0, 4) };
}
