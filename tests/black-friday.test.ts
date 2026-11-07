import { test } from "node:test";
import assert from "node:assert/strict";
import { blackFriday, cyberMonday, inSeason, seasonYear } from "../src/lib/black-friday";

test("Black Friday is the day after US Thanksgiving", () => {
  assert.equal(blackFriday(2026), "2026-11-27");
  assert.equal(blackFriday(2025), "2025-11-28");
  assert.equal(cyberMonday(2026), "2026-11-30");
});

test("season window and year roll over a week after Cyber Monday", () => {
  assert.equal(inSeason("2026-10-31"), false);
  assert.equal(inSeason("2026-11-01"), true);
  assert.equal(inSeason("2026-12-08"), false);
  assert.equal(seasonYear("2026-12-08"), 2027);
});

test("the strip shows Black Friday from 1 November, then Cyber Monday, then nothing", async () => {
  const { saleStrip, holidayFaq } = await import("../src/lib/black-friday");
  assert.equal(saleStrip("2026-10-31"), null);
  assert.equal(saleStrip("2026-11-07")?.path, "/black-friday");
  assert.equal(saleStrip("2026-11-28")?.path, "/black-friday");
  assert.equal(saleStrip("2026-11-29")?.path, "/cyber-monday");
  assert.equal(saleStrip("2026-12-01")?.path, "/cyber-monday");
  assert.equal(saleStrip("2026-12-02"), null);
  assert.match(holidayFaq("cyber-monday", 2026, "Australia")[0].a, /Monday 30 November/);
});
