// Drones and camera glasses (DECISIONS.md, "Drones and smart glasses"): real
// store titles from the stores' own listings, against the real catalog.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readCameraFiles, readLensFiles } from "../src/lib/catalog/load";
import { cameraSchema } from "../src/lib/catalog/schema";
import { buildIndex, matchListing, titleGeneration } from "../src/lib/matching";
import { SPEC_GROUPS } from "../src/lib/specs/definitions";

const cameras = readCameraFiles().cameras;
const index = buildIndex(cameras, readLensFiles().lenses);
const m = (title: string) => {
  const r = matchListing({ title }, index);
  return r.product ? `${r.product.slug}${r.kit ? " bundle" : ""}` : null;
};

test("the catalog has drones and camera glasses", () => {
  assert.ok(cameras.filter((c) => c.type === "drone").length >= 10);
  assert.ok(cameras.filter((c) => c.type === "smart-glasses").length >= 5);
});

test("a drone with its standard remote is the drone; combos and add-ons are bundles", () => {
  assert.equal(m("DJI Mini 4 Pro (DJI RC 2)"), "dji-mini-4-pro");
  assert.equal(m("DJI Mini 4 Pro Drone with DJI RC-N2 Controller"), "dji-mini-4-pro");
  assert.equal(m("DJI Air 3S Drone with DJI RC-N3 Remote Control"), "dji-air-3s");
  assert.equal(m("DJI Avata 2 (Drone Only) FPV Drone with Camera 4K"), "dji-avata-2");
  assert.equal(m("DJI Mini 4 Pro Fly More Combo Plus (DJI RC 2)"), "dji-mini-4-pro bundle");
  assert.equal(m("DJI Mavic 4 Pro 512GB Creator Combo (DJI RC Pro 2)"), "dji-mavic-4-pro bundle");
  assert.equal(m("DJI Mini 4 Pro (GL) with Custom Insert Hard-Shell Storage Case and 128GB Memory Card"), "dji-mini-4-pro bundle");
  assert.equal(m("DJI Neo Combo (Global)"), "dji-neo bundle");
});

test("drone parts, services and other models are refused", () => {
  assert.equal(m("DJI Mini 4 Pro Intelligent Flight Battery"), null);
  assert.equal(m("DJI Mini 4 Pro Wide-Angle Lens"), null);
  assert.equal(m("DJI Mavic 3 Series Low-Noise Propeller Pair"), null);
  assert.equal(m("DJI Care Mavic 4 Pro - 1 Year Plan - License No."), null);
  assert.equal(m("DJI Mini 3 Pro Fly More Kit Drone Accessory Bundle"), null);
  assert.equal(m("PolarPro DJI Mavic 3 Pro Shutter Collection ( ND8, ND16, ND32 )"), null);
  assert.equal(m("DJI Mavic 3 Pro Cine Premium Combo"), null); // a different, dearer drone
  assert.equal(m("DJI Mini 3 Camera Drone with DJI RC Remote Controller"), null); // not in the catalog
  assert.equal(m("Low-Noise Propellers for DJI Mini 4 Pro"), null);
});

test("one-word DJI names need the brand right before them", () => {
  assert.equal(m("DJI Flip (DJI RC-N3)"), "dji-flip");
  assert.equal(m("DJI Neo Drone"), "dji-neo");
  assert.equal(m("DJI Osmo Mobile 7P Gimbal with Flip Design"), null);
});

test("Ray-Ban Meta Gen 1 and Gen 2 are told apart only by the title's generation", () => {
  assert.equal(titleGeneration("ray-ban meta wayfarer (gen 2)"), 2);
  assert.equal(titleGeneration("ray-ban meta 2nd gen skyler"), 2);
  assert.equal(titleGeneration("ray-ban meta skyler"), null);
  assert.equal(m("Ray-Ban Meta Wayfarer Gen 2 Smart Glasses (Matte Black/Clear)"), "meta-ray-ban-meta-gen-2");
  assert.equal(m("Ray-Ban Meta - Wayfarer (Gen 2) Smart Glasses - Shiny Black/Clear"), "meta-ray-ban-meta-gen-2");
  assert.equal(m("Ray-Ban Meta Wayfarer (Gen 1) Matte Black"), "meta-ray-ban-meta-gen-1");
  assert.equal(m("Ray-Ban Meta Skyler Smart Glasses Shiny Black"), null);
  assert.equal(m("Ray-Ban Meta Gen 3 Wayfarer"), null);
});

test("other camera glasses, and their parts", () => {
  assert.equal(m("Meta Ray-Ban Display with Meta Neural Band, Black, Standard"), "meta-ray-ban-display");
  assert.equal(m("Oakley Meta Vanguard Black Prizm 24K"), "meta-oakley-meta-vanguard");
  assert.equal(m("Oakley Meta HSTN Prizm Ruby"), "meta-oakley-meta-hstn");
  assert.equal(m("Ray-Ban Meta Gen 2 Charging Case"), null);
  assert.equal(m("Prescription Lenses for Ray-Ban Meta Wayfarer Gen 2"), null);
});

test("flight specs belong to drones, battery hours to glasses, and only glasses may skip the sensor size", () => {
  const mini = cameras.find((c) => c.slug === "dji-mini-4-pro")!;
  const a7 = cameras.find((c) => c.type === "mirrorless")!;
  assert.equal(cameraSchema.safeParse({ ...a7, specs: { ...a7.specs, flightTimeMin: 30 } }).success, false);
  assert.equal(cameraSchema.safeParse({ ...a7, specs: { ...a7.specs, sensorFormat: null } }).success, false);
  assert.equal(cameraSchema.safeParse({ ...mini, specs: { ...mini.specs, batteryHours: 4 } }).success, false);
});

test("the flight group shows only where a product has those specs", () => {
  const g = SPEC_GROUPS.find((x) => x.id === "flight")!;
  assert.ok(g.specs.every((s) => s.optional));
  const a7 = cameras.find((c) => c.type === "mirrorless")!;
  assert.ok(g.specs.every((s) => s.format(a7) === null));
  const mini = cameras.find((c) => c.slug === "dji-mini-4-pro")!;
  assert.equal(g.specs.find((s) => s.key === "flightTimeMin")!.format(mini), "34 min");
});
