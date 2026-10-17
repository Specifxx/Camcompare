// Client-safe half of lib/summary.ts: the summary types and priceOf. Client
// components import from here; summary.ts (which reads the catalog) is server-only.
import type { Camera, Lens } from "./catalog/schema";
import type { Currency } from "./markets";
import type { LensCategory } from "./specs/lens";

export type Base = {
  slug: string;
  name: string;
  shortName: string;
  brand: string;
  brandName: string;
  announced: string;
  status: "current" | "discontinued";
  currency: Currency;
  launch: number | null; // whole units in `currency`
  lowestNew: number | null; // minor units in `currency`
  lowestUsed: number | null;
  stores: number; // retailers with an in-stock offer in this market (Amazon not counted)
  weightG: number | null;
  sealed: boolean | null;
};

export type CameraSummary = Base & {
  kind: "camera";
  type: Camera["type"];
  sensor: Camera["specs"]["sensorFormat"];
  mount: string | null;
  megapixels: number;
  ibis: boolean | null;
  videoMaxRes: string | null;
  video4kMaxFps: number | null;
  burstFps: number | null;
  evf: boolean;
  articulating: boolean;
  micJack: boolean | null;
  dims: [number, number, number] | null;
  subjects: string[] | null;
  waterproofM: number | null;
  fixedZoom: boolean;
};

export type LensSummary = Base & {
  kind: "lens";
  mounts: string[];
  coverage: Lens["coverage"];
  focalMin: number;
  focalMax: number;
  eqMin: number;
  eqMax: number;
  aperture: number;
  apertureTele: number | null;
  autofocus: boolean;
  stabilized: boolean | null;
  categories: LensCategory[];
};

export type ProductSummary = CameraSummary | LensSummary;

/** Today's lowest price, else the launch price, in whole units: what "under X" filters on. */
export const priceOf = (s: Pick<Base, "lowestNew" | "lowestUsed" | "launch">) =>
  s.lowestNew !== null ? s.lowestNew / 100 : s.lowestUsed !== null ? s.lowestUsed / 100 : s.launch;
