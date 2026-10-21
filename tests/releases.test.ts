import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTarget, targetKey } from "../src/lib/community/rules";
import { buildIndex } from "../src/lib/matching";
import { isReleaseBrand, RELEASE_BRANDS } from "../src/lib/releases/brands";
import { decodeXml, isAnnouncement, KEEP_DAYS, matchProducts, mergeReleases, parseFeed, parseYoutubeApi, RECENT_DAYS, releaseId, releasesFileSchema, type Release } from "../src/lib/releases/core";
import { serializeReleases } from "../src/lib/releases/data";
import { canOrder, offerState, orderState, storeRows } from "../src/lib/releases/stock";
import type { Offer } from "../src/lib/offers";
import { CAMERAS } from "./fixtures";

const YT = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <title>Nikon USA</title>
 <published>2009-01-01T00:00:00+00:00</published>
 <entry>
  <id>yt:video:abcDEF12345</id>
  <yt:videoId>abcDEF12345</yt:videoId>
  <title>Introducing the Nikon Z6III &amp; more</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=abcDEF12345"/>
  <published>2026-10-20T13:00:00+00:00</published>
 </entry>
 <entry><title>No link</title><published>2026-10-20T13:00:00+00:00</published></entry>
</feed>`;

const RSS = `<rss version="2.0"><channel><title>News</title>
<item><title><![CDATA[Ricoh Imaging Announces RICOH GR IVx]]></title><link>https://us.ricoh-imaging.com/news/grivx</link><pubDate>Tue, 06 Oct 2026 10:00:00 +0900</pubDate></item>
<item><title>Bad date</title><link>https://x.example/a</link><pubDate>someday</pubDate></item>
</channel></rss>`;

test("feeds: YouTube Atom and RSS 2.0 parse; items without a link or date are skipped", () => {
  assert.deepEqual(parseFeed(YT), [{ title: "Introducing the Nikon Z6III & more", url: "https://www.youtube.com/watch?v=abcDEF12345", publishedAt: "2026-10-20T13:00:00.000Z", videoId: "abcDEF12345" }]);
  assert.deepEqual(parseFeed(RSS), [{ title: "Ricoh Imaging Announces RICOH GR IVx", url: "https://us.ricoh-imaging.com/news/grivx", publishedAt: "2026-10-06T01:00:00.000Z" }]);
  assert.equal(decodeXml("A &#038; B &#x2014; <b>C</b>"), "A & B — C");
  const api = parseYoutubeApi({ items: [{ snippet: { title: "New FX5", publishedAt: "2026-10-20T00:00:00Z", resourceId: { videoId: "zzzzzzzzzzz" } } }, { snippet: { title: "Private video", publishedAt: "2026-10-20T00:00:00Z", resourceId: { videoId: "yyyyyyyyyyy" } } }] });
  assert.deepEqual(api.map((i) => [i.title, i.url, i.videoId]), [["New FX5", "https://www.youtube.com/watch?v=zzzzzzzzzzz", "zzzzzzzzzzz"]]);
});

test("announcements: launch words count, tutorials, firmware and corporate news don't", () => {
  const yes = [
    "Introducing the NEW TAMRON 16-50mm F2.8 A | Sony E, Canon RF, Nikon Z & Fujifilm X",
    "Meet the all-new Z5IIC, our beginner-friendly full-frame camera",
    "Ricoh Imaging Announces RICOH GR IVx Currently Under Development",
    "Nikon is developing the NIKKOR Z 120-300mm f/2.8 TC VR S",
    "NEW RELEASE! Ulanzi 30W Inflatable Tube Light",
    "DJI Osmo Pocket 4P is now available in Pearl White",
    "Pre-orders open: Sony FX5",
  ];
  const no = [
    "How to set up the Sony FX3 for weddings",
    "New Firmware Update for RICOH GR IV Monochrome (Version 1.10)",
    "Apple announces American Manufacturing Program partners for latest iPhone lineup",
    "Introducing the Canon imageFORCE 8100 Series",
    "Live webinar: what's new in LUMIX Lab",
    "Stunt Plane POV 🎬 Patrick McAlee #GoPro",
    "Tiny box. Big wait.",
    "Lesson of the day: Film is a collaborative experience",
  ];
  for (const t of yes) assert.ok(isAnnouncement(t), t);
  for (const t of no) assert.ok(!isAnnouncement(t), t);
});

const IX = buildIndex([...CAMERAS, { ...CAMERAS[0], slug: "dji-osmo-pocket", brand: "dji", name: "Osmo Pocket", shortName: "Osmo Pocket", aliases: ["Osmo Pocket"], modelCodes: [], gtins: [], mount: null }]);

test("products: named ones of the release's brand only, never another model or an accessory", () => {
  assert.deepEqual(matchProducts("Introducing the Z6III", "Nikon", "nikon", IX), ["nikon-z6-iii"]);
  assert.deepEqual(matchProducts("Nikon Z6 II vs Z6 III: what changed", "Nikon", "nikon", IX).sort(), ["nikon-z6-ii", "nikon-z6-iii"]);
  assert.deepEqual(matchProducts("DJI Osmo Pocket 4P is now available", "DJI", "dji", IX), [], "4P is another model");
  assert.deepEqual(matchProducts("Meet the cage your EOS R5 needs", "Kondor Blue", "kondor-blue", IX), [], "another maker's channel");
  assert.deepEqual(matchProducts("Introducing the Z6III", "Sony", "sony", IX), [], "wrong brand");
});

const rel = (o: Partial<Release>): Release => ({ id: releaseId(o.url ?? "https://x.example/1"), brand: "sony", title: "New", url: "https://x.example/1", publishedAt: "2026-10-20T00:00:00.000Z", kind: "video", products: [], isAnnouncement: true, ...o });

test("merge: newest first, refreshed in place, announcements kept six months and the rest three weeks", () => {
  const now = "2026-10-21T00:00:00.000Z";
  const day = (n: number) => new Date(Date.parse(now) - n * 86_400_000).toISOString();
  const old = rel({ url: "https://x.example/old", publishedAt: day(KEEP_DAYS + 1) });
  const keep = rel({ url: "https://x.example/keep", publishedAt: day(KEEP_DAYS - 1) });
  const tut = rel({ url: "https://x.example/tut", publishedAt: day(RECENT_DAYS + 1), isAnnouncement: false });
  const fresh = rel({ url: "https://x.example/keep", publishedAt: keep.publishedAt, title: "Edited title" });
  const nu = rel({ url: "https://x.example/new", publishedAt: day(0) });
  const out = mergeReleases([old, keep, tut], [fresh, nu], now);
  assert.deepEqual(out.map((r) => r.url), ["https://x.example/new", "https://x.example/keep"]);
  assert.equal(out[1].title, "Edited title");
  assert.match(releaseId("https://x.example/new"), /^r[0-9a-f]{12}$/);
  const text = serializeReleases({ generatedAt: now, sources: { a: { status: "ok", items: 1 } }, releases: out });
  assert.deepEqual(releasesFileSchema.parse(JSON.parse(text)).releases, out);
  assert.equal(text.split("\n").length, out.length + 3, "one release per line");
});

test("every watched brand has a feed, keys are slug-safe and unique", () => {
  const keys = RELEASE_BRANDS.map((b) => b.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const b of RELEASE_BRANDS) {
    assert.ok(b.feeds.length > 0, b.key);
    assert.match(b.key, /^[a-z0-9][a-z0-9-]{0,40}$/);
    for (const f of b.feeds) if (f.type === "youtube") assert.match(f.channelId, /^UC[A-Za-z0-9_-]{22}$/, b.key);
  }
  assert.ok(isReleaseBrand("godox") && !isReleaseBrand("akg"));
});

test("comments: release:<id> is a discussion target", () => {
  const id = releaseId("https://x.example/1");
  assert.deepEqual(parseTarget(`release:${id}`), { kind: "release", id });
  assert.equal(targetKey({ kind: "release", id }), `release:${id}`);
  assert.equal(parseTarget("release:../x"), null);
});

const offer = (o: Partial<Offer>): Offer => ({ product: "x", kind: "camera", retailer: "bh", condition: "new", price: 1000, currency: "USD", url: "https://example.com/x", title: "X", seller: null, inStock: false, kit: false, mount: null, seenAt: "2026-10-17T00:00:00Z", sourceId: null, ...o });

test("stock: availability beats in/out, stores only (no eBay, Amazon or marketplace sellers)", () => {
  assert.equal(offerState(offer({ inStock: true })), "in_stock");
  assert.equal(offerState(offer({ inStock: false, availability: "preorder" })), "preorder");
  assert.equal(offerState(offer({ inStock: true, availability: "backorder" })), "backorder");
  assert.equal(orderState([]), "none");
  assert.equal(orderState([offer({}), offer({ retailer: "adorama", availability: "preorder" })]), "preorder");
  assert.equal(orderState([offer({ retailer: "ebay", inStock: true }), offer({ retailer: "amazon", inStock: true }), offer({ seller: "someone", inStock: true })]), "none");
  assert.equal(orderState([offer({ condition: "used", inStock: true })]), "none", "a preorder is for new stock");
  assert.equal(orderState([offer({ condition: "used", inStock: true })], "any"), "in_stock");
  assert.ok(canOrder("preorder") && canOrder("in_stock") && !canOrder("backorder"));
  const rows = storeRows([offer({ price: 900 }), offer({ retailer: "adorama", price: 1200, availability: "preorder" }), offer({ price: 950, inStock: true }), offer({ retailer: "ebay", inStock: true })]);
  assert.deepEqual(rows.map((r) => [r.offer.retailer, r.state, r.offer.price]), [["bh", "in_stock", 950], ["adorama", "preorder", 1200]]);
});
