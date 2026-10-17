// Derived facts shown on product pages. Everything here is arithmetic over
// the catalog and our own price history — no opinions, no scores.
import type { Camera } from "./catalog/schema";
import { publishedCameras } from "./catalog";
import type { HistoryPoint } from "./offers";
import { sensorLabel, typeLabel } from "./specs/definitions";

type Metric = { key: string; label: string; phrase: string; better: "higher" | "lower"; get: (c: Camera) => number | null; unit: (v: number) => string };

const METRICS: Metric[] = [
  { key: "megapixels", label: "resolution", phrase: "more resolution than", better: "higher", get: (c) => c.specs.megapixels, unit: (v) => `${v} MP` },
  { key: "burst", label: "burst speed", phrase: "faster bursts than", better: "higher", get: (c) => Math.max(c.specs.burstMechFps ?? 0, c.specs.burstElecFps ?? 0) || null, unit: (v) => `${v} fps` },
  { key: "weight", label: "weight", phrase: "lighter than", better: "lower", get: (c) => c.specs.weightG, unit: (v) => `${v} g` },
  { key: "battery", label: "battery life", phrase: "longer battery life than", better: "higher", get: (c) => c.specs.batteryShotsCipa, unit: (v) => `${v} shots` },
  { key: "ibis", label: "stabilisation", phrase: "more stabilisation than", better: "higher", get: (c) => (c.specs.ibis ? c.specs.ibisStops : null), unit: (v) => `${v} stops` },
  { key: "evf", label: "viewfinder resolution", phrase: "a sharper viewfinder than", better: "higher", get: (c) => c.specs.evfDotsM, unit: (v) => `${v}M dots` },
];

export type PeerRank = { label: string; phrase: string; value: string; pct: number; better: "higher" | "lower"; peers: number; group: string };

/**
 * Where a camera sits among its peers (same sensor size and type), metric by
 * metric: "lighter than 80% of full-frame mirrorless cameras". Only metrics
 * where the camera and at least 8 peers have a value; strongest first.
 */
export function peerRanks(c: Camera, minPeers = 8): PeerRank[] {
  const peers = publishedCameras().filter((p) => p.slug !== c.slug && p.type === c.type && p.specs.sensorFormat === c.specs.sensorFormat);
  const group = `${sensorLabel(c.specs.sensorFormat).toLowerCase()} ${typeLabel(c.type).toLowerCase()} cameras`;
  const out: PeerRank[] = [];
  for (const m of METRICS) {
    const v = m.get(c);
    if (v === null) continue;
    const values = peers.map(m.get).filter((x): x is number => x !== null);
    if (values.length < minPeers) continue;
    const beaten = values.filter((x) => (m.better === "higher" ? x < v : x > v)).length;
    out.push({ label: m.label, phrase: m.phrase, value: m.unit(v), pct: Math.round((beaten / values.length) * 100), better: m.better, peers: values.length, group });
  }
  return out.sort((a, b) => b.pct - a.pct);
}

export type DealSignal = { kind: "low-90" | "below-avg" | "above-avg"; text: string } | null;

/**
 * How today's lowest new price compares with our own history in this market.
 * Needs two weeks of history; says nothing rather than guess.
 */
export function dealSignal(history: HistoryPoint[], todayMinor: number | null, field: "new" | "used" = "new"): DealSignal {
  if (todayMinor === null) return null;
  const pts = history.filter((p) => p[field] !== undefined).slice(-90);
  if (pts.length < 14) return null;
  const vals = pts.map((p) => p[field]!);
  const min90 = Math.min(...vals);
  const last30 = vals.slice(-30);
  const avg30 = last30.reduce((a, b) => a + b, 0) / last30.length;
  if (todayMinor <= min90) return { kind: "low-90", text: `Lowest ${field} price we've seen in ${pts.length} days` };
  const pct = Math.round(((avg30 - todayMinor) / avg30) * 100);
  if (pct >= 3) return { kind: "below-avg", text: `${pct}% below its 30-day average` };
  if (pct <= -3) return { kind: "above-avg", text: `${-pct}% above its 30-day average` };
  return null;
}

/** Used price as a share of new: how much buying used saves today. */
export function usedSaving(newMinor: number | null, usedMinor: number | null): number | null {
  if (newMinor === null || usedMinor === null || usedMinor >= newMinor) return null;
  return Math.round(((newMinor - usedMinor) / newMinor) * 100);
}

/** Today's price against the launch list price (both in the same currency). */
export function vsLaunch(todayMinor: number | null, launch: number | null): number | null {
  if (todayMinor === null || !launch) return null;
  return Math.round(((todayMinor / 100 - launch) / launch) * 100);
}

/** Biggest drops: today's lowest vs the same product's lowest 7 days ago. */
export function priceDrops(history: Map<string, HistoryPoint[]>, field: "new" | "used", minPct = 3): { slug: string; from: number; to: number; pct: number }[] {
  const out: { slug: string; from: number; to: number; pct: number }[] = [];
  for (const [slug, pts] of history) {
    const withVal = pts.filter((p) => p[field] !== undefined);
    if (withVal.length < 2) continue;
    const last = withVal[withVal.length - 1];
    const lastDay = Date.parse(last.day);
    const before = [...withVal].reverse().find((p) => lastDay - Date.parse(p.day) >= 7 * 86400_000) ?? withVal[0];
    if (before === last) continue;
    const pct = Math.round(((before[field]! - last[field]!) / before[field]!) * 100);
    if (pct >= minPct) out.push({ slug, from: before[field]!, to: last[field]!, pct });
  }
  return out.sort((a, b) => b.pct - a.pct);
}
