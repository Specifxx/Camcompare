// Member stories, the request board and the curated pages: the pure rules
// (Markdown subset, cover rule, inputs, targets) and the static-shell
// guarantees from CLAUDE.md's community exception. No database needed.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { camera } from "../src/lib/catalog";
import { parseTarget, targetKey, VOTE_KINDS } from "../src/lib/community/rules";
import { REQUEST_STATUS_SLUGS } from "../src/lib/community/requests";
import { coverUrl, parseInline, parseStory, plainOf, readMinutes, safeHref, STORY_BODY_MIN, storyExcerpt, storyPath } from "../src/lib/community/stories";
import { featureInput, moderateInput, reportInput, requestInput, requestStatusInput, storyInput, voteInput } from "../src/lib/community/validate";
import { availabilityOf, digicamGroups, digicams, readViral, viralCameras } from "../src/lib/curated";
import type { Offer } from "../src/lib/offers";

const body = (s = "") => `${s}\n\n${"I shot with it every day for a month. ".repeat(8)}`;

test("targets: post and request ids join product, deal and thread", () => {
  assert.deepEqual(parseTarget("post:7"), { kind: "post", id: "7" });
  assert.deepEqual(parseTarget("request:12"), { kind: "request", id: "12" });
  for (const bad of ["post:0", "post:x", "request:", "story:1"]) assert.equal(parseTarget(bad), null, bad);
  assert.equal(targetKey(parseTarget("post:7")!), "post:7");
  assert.equal(targetKey(parseTarget("request:12")!), "request:12");
  assert.ok(VOTE_KINDS.includes("post") && VOTE_KINDS.includes("request"));
  assert.ok(voteInput.safeParse({ kind: "post", target: "5", value: 1 }).success);
  assert.ok(!voteInput.safeParse({ kind: "request", target: "us:x", value: 1 }).success);
  assert.ok(reportInput.safeParse({ kind: "post", id: "5", reason: "spam" }).success);
  assert.ok(moderateInput.safeParse({ action: "hide", kind: "request", id: "5" }).success);
});

test("Markdown subset: headings, lists, quotes, marks; everything else is text", () => {
  const b = parseStory("# Title-ish\n## Handling\nIt's **light** and *quick*.\nSecond line.\n\n- one\n- two\n\n1. first\n2) second\n\n> quoted\n\n---\n### Verdict");
  assert.deepEqual(
    b.map((x) => x.t),
    ["h2", "h2", "p", "ul", "ol", "quote", "hr", "h3"],
  );
  const p = b[2] as { t: "p"; lines: ReturnType<typeof parseInline>[] };
  assert.equal(p.lines.length, 2);
  assert.deepEqual(p.lines[0].map((x) => x.t), ["text", "b", "text", "i", "text"]);
  assert.equal(plainOf(p.lines[0]), "It's light and quick.");
});

test("links: http(s) only; javascript:, data: and relative targets stay text; images become links", () => {
  const ok = parseInline("see [the review](https://example.com/r?a=1) and https://x.org/y.");
  assert.deepEqual(
    ok.filter((x) => x.t === "a").map((x) => (x as { href: string }).href),
    ["https://example.com/r?a=1", "https://x.org/y"],
  );
  for (const bad of ["[x](javascript:alert(1))", "[x](data:text/html,hi)", "[x](/admin)", "[x](//evil.com)"]) assert.ok(!parseInline(bad).some((x) => x.t === "a"), bad);
  const img = parseInline("![my shot](https://img.example.com/a.jpg)");
  assert.equal(img[0].t, "a");
  assert.equal(plainOf(img), "my shot (image link)");
  assert.equal(safeHref("https://user:pw@example.com/"), null);
  // Raw HTML never becomes markup: the parser only ever emits text runs for it.
  const html = parseStory('<img src=x onerror=alert(1)> <script>alert(1)</script>');
  assert.equal(html.length, 1);
  assert.equal(html[0].t, "p");
  assert.ok((html[0] as { lines: { t: string }[][] }).lines.flat().every((x) => x.t === "text"), "only text nodes");
});

test("excerpt and reading time drop the marks", () => {
  assert.equal(storyExcerpt("## Intro\nA **bold** claim with a [link](https://a.com)."), "Intro A bold claim with a link.");
  const long = storyExcerpt("word ".repeat(200), 50);
  assert.ok(long.length <= 50 && long.endsWith("…"));
  assert.equal(readMinutes("a ".repeat(460)), 2);
  assert.equal(storyPath("9"), "/stories/p/9");
});

test("cover image: https on a real host name only", () => {
  assert.equal(coverUrl("https://images.example.com/a.jpg"), "https://images.example.com/a.jpg");
  for (const bad of ["http://example.com/a.jpg", "https://localhost/a.jpg", "https://127.0.0.1/a.jpg", "https://[::1]/a.jpg", "https://u:p@example.com/a.jpg", "https://example.com:8443/a.jpg", "javascript:alert(1)", "https://intranet/a.jpg", `https://e.com/${"a".repeat(600)}`])
    assert.equal(coverUrl(bad), null, bad);
});

test("story input: cleaned before length checks, tags and products bounded", () => {
  const good = storyInput.safeParse({ title: "Six months with the GR IIIx", body: body("## Handling"), tags: ["review", "review"], products: ["ricoh-gr-iiix"], cover: "" });
  assert.ok(good.success);
  if (good.success) {
    assert.deepEqual(good.data.tags, ["review"]);
    assert.equal(good.data.cover, null);
  }
  assert.ok(!storyInput.safeParse({ title: "Short", body: body(), tags: ["review"] }).success, "title too short");
  assert.ok(!storyInput.safeParse({ title: "A fine title here", body: `<p>${"<b></b>".repeat(STORY_BODY_MIN)}</p>`, tags: ["review"] }).success, "tags only");
  assert.ok(!storyInput.safeParse({ title: "A fine title here", body: body(), tags: [] }).success, "a tag");
  assert.ok(!storyInput.safeParse({ title: "A fine title here", body: body(), tags: ["review", "guide", "deal-tip", "comparison"] }).success, "too many tags");
  assert.ok(!storyInput.safeParse({ title: "A fine title here", body: body(), tags: ["hype"] }).success, "unknown tag");
  assert.ok(!storyInput.safeParse({ title: "A fine title here", body: body(), tags: ["guide"], cover: "http://x.com/a.jpg" }).success, "http cover");
  assert.ok(!storyInput.safeParse({ title: "A fine title here", body: body(), tags: ["guide"], products: ["Not A Slug"] }).success, "bad slug");
  const stripped = storyInput.safeParse({ title: "<b>Bold</b> title text", body: body("<script>alert(1)</script>"), tags: ["guide"] });
  assert.ok(stripped.success && !stripped.data.body.includes("<script") && stripped.data.title === "Bold title text");
});

test("requests: input, owner status and feature switch", () => {
  assert.ok(requestInput.safeParse({ kind: "store", title: "Track Camera House", body: "" }).success);
  assert.ok(!requestInput.safeParse({ kind: "store", title: "short", body: "" }).success);
  assert.ok(!requestInput.safeParse({ kind: "bribe", title: "Track Camera House", body: "" }).success);
  for (const s of REQUEST_STATUS_SLUGS) assert.ok(requestStatusInput.safeParse({ id: "3", status: s, note: "" }).success, s);
  assert.ok(!requestStatusInput.safeParse({ id: "3", status: "maybe" }).success);
  assert.deepEqual(featureInput.parse({ id: "4", featured: "1" }), { id: "4", featured: true });
  assert.ok(!featureInput.safeParse({ id: "4", featured: "yes" }).success);
});

test("curated: viral.json names published cameras; digicams are the compacts", () => {
  const file = readViral();
  for (const e of file.cameras) assert.ok(camera(e.slug), `data/viral.json: ${e.slug} is not a published camera`);
  assert.equal(viralCameras().length, new Set(file.cameras.map((c) => c.slug)).size);
  const all = digicams();
  assert.ok(all.length > 20 && all.every((c) => c.type === "compact"));
  const grouped = digicamGroups().flatMap((g) => g.cameras.map((c) => c.slug));
  assert.equal(grouped.length, all.length, "each digicam in exactly one group");
  assert.equal(new Set(grouped).size, all.length);
});

test("availability: backorder and pre-order notes, Amazon and kits left out", () => {
  const o = (x: Partial<Offer>): Offer => ({ product: "x", kind: "camera", retailer: "adorama", condition: "new", price: 100, currency: "USD", url: "https://a.com", title: "x", seller: null, inStock: true, kit: false, mount: null, seenAt: "", sourceId: null, ...x });
  assert.equal(availabilityOf([o({})]).note, null);
  assert.equal(availabilityOf([o({})]).inStock, 1);
  const bo = availabilityOf([o({ availability: "backorder" }), o({ retailer: "bh", availability: "preorder", inStock: false })], (id) => id.toUpperCase());
  assert.equal(bo.inStock, 0);
  assert.equal(bo.note, "Backordered at ADORAMA · Pre-order at BH");
  assert.equal(availabilityOf([o({ inStock: false })]).note, "Out of stock at the one store we track");
  assert.match(availabilityOf([o({ inStock: false }), o({ retailer: "bh", inStock: false })]).note ?? "", /Out of stock at all 2 stores/);
  assert.match(availabilityOf([]).note ?? "", /No store we track/);
  assert.equal(availabilityOf([o({ kit: true, availability: "backorder" })]).backorder.length, 0);
});

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

test("stories, requests and My gear pages are static shells: no server reads, no revalidate", () => {
  const files = ["src/app/stories/page.tsx", "src/app/stories/new/page.tsx", "src/app/stories/p/page.tsx", "src/app/requests/page.tsx", "src/app/collection/page.tsx", "src/components/curated/DigicamsView.tsx", "src/components/curated/ViralView.tsx"];
  for (const f of files) {
    const s = read(f);
    assert.ok(!/stories-db|community\/db|revalidate|force-dynamic/.test(s), `${f} must not read the community tables or set revalidate`);
  }
  for (const f of ["src/components/community/Stories.tsx", "src/components/community/StoryPage.tsx", "src/components/community/ProductStories.tsx", "src/components/community/Requests.tsx", "src/components/collection/MyGear.tsx"])
    assert.ok(read(f).startsWith('"use client"'), `${f} is a client component`);
  assert.ok(/\/stories\/p\/:id\(\\\\d\{1,18\}\)/.test(read("next.config.js")), "the /stories/p/<id> rewrite");
  // The shell has no robots tag (StoryPage adds noindex unless featured) and no canonical of its own.
  assert.ok(!/robots|canonical/.test(read("src/app/stories/p/page.tsx").replace(/\/\/.*$/gm, "")));
  // Covers: lazy, no referrer, and only ever served for featured stories.
  assert.ok(/referrerPolicy="no-referrer"/.test(read("src/components/community/Stories.tsx")) && /loading="lazy"/.test(read("src/components/community/Stories.tsx")));
  assert.ok(/cover: featured \?/.test(read("src/lib/community/stories-db.ts")));
});

test("the gear list is private: its route is no-store and never public", () => {
  const s = read("src/app/api/community/collection/route.ts");
  assert.ok(!/publicJson|PUBLIC_CACHE/.test(s));
  assert.ok(/requireMember/.test(s));
});
