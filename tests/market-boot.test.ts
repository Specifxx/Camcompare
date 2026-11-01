import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { MARKET_BOOT_SCRIPT } from "../src/lib/market-boot";

// Owner, 2026-11-01: the visitor's own market by default, the US when we can't tell; crawlers are never moved.

function boot(path: string, tz: string, opts: { saved?: string; ua?: string; alternates?: Record<string, string> } = {}) {
  const attrs: Record<string, string> = {};
  let moved: string | null = null;
  vm.runInNewContext(MARKET_BOOT_SCRIPT, {
    URL,
    navigator: { userAgent: opts.ua ?? "Mozilla/5.0 (iPhone) Safari/604.1" },
    location: { pathname: path, search: "", hash: "", href: `https://www.camcompare.app${path}`, replace: (u: string) => (moved = u) },
    localStorage: { getItem: () => opts.saved ?? null, setItem() {} },
    sessionStorage: { getItem: () => null, setItem() {} },
    Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: tz }) }) },
    setTimeout: () => 0,
    document: {
      readyState: "complete",
      addEventListener() {},
      documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v), removeAttribute: (k: string) => delete attrs[k] },
      querySelector: (sel: string) => {
        const lang = /hreflang="([^"]+)"/.exec(sel)?.[1] ?? "";
        const href = opts.alternates?.[lang];
        return href ? { href: `https://www.camcompare.app${href}` } : null;
      },
    },
  });
  return moved;
}

const alts = { "en-US": "/cameras/a7-iv", "en-GB": "/uk/cameras/a7-iv", "en-IE": "/eu/cameras/a7-iv", "en-DE": "/eu/cameras/a7-iv", "en-AU": "/au/cameras/a7-iv", "en-SG": "/sg/cameras/a7-iv" };

test("a visitor is moved to their own market's copy; crawlers and global pages never are", () => {
  assert.equal(boot("/cameras/a7-iv", "Australia/Sydney", { alternates: alts }), "/au/cameras/a7-iv");
  assert.equal(boot("/cameras/a7-iv", "Europe/Berlin", { alternates: alts }), "/eu/cameras/a7-iv");
  assert.equal(boot("/uk/cameras/a7-iv", "America/Denver", { alternates: alts }), "/cameras/a7-iv");
  assert.equal(boot("/uk/cameras/a7-iv", "Asia/Tokyo", { alternates: alts }), "/cameras/a7-iv", "unknown → US");
  assert.equal(boot("/cameras/a7-iv", "America/Denver", { alternates: alts }), null);
  assert.equal(boot("/cameras/a7-iv", "Australia/Sydney", { saved: "us", alternates: alts }), null, "a picked market wins");
  assert.equal(boot("/au/cameras/a7-iv", "America/Denver", { ua: "Googlebot/2.1", alternates: alts }), null);
  assert.equal(boot("/compare/a-vs-b", "Australia/Sydney", { alternates: alts }), null, "global pages stay");
  assert.equal(boot("/guides/x", "Europe/London", { alternates: alts }), null);
  assert.doesNotThrow(() => vm.runInNewContext(MARKET_BOOT_SCRIPT, {}));
});

test("the layout runs it before paint", () => {
  assert.match(readFileSync("src/app/layout.tsx", "utf8"), /__html: MARKET_BOOT_SCRIPT/);
  assert.match(readFileSync("src/app/globals.css", "utf8"), /html\[data-geo="pending"\] main \{ visibility: hidden; \}/);
});
