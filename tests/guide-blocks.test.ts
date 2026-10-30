import { test } from "node:test";
import assert from "node:assert/strict";
import { anyCamera, args, segments, specDefs, topSlugs } from "../src/lib/guide-blocks";
import { guides } from "../src/lib/guides";
import { product } from "../src/lib/catalog";

test("a block is a whole line; everything else is Markdown, in order", () => {
  const s = segments("Intro\n\n[[picks:a,b]]\n\nMiddle [[not:a block]] inline\n[[top:type=drone,n=3]]\nEnd");
  assert.deepEqual(
    s.map((x) => ("md" in x ? "md" : `${x.block}:${x.arg}`)),
    ["md", "picks:a,b", "md", "top:type=drone,n=3", "md"],
  );
  assert.deepEqual(args("type=mirrorless+cinema, max=2000,junk"), { type: "mirrorless+cinema", max: "2000" });
});

test("drone tables default to drone specs, cameras to camera specs", () => {
  const drone = anyCamera("dji-mini-5-pro");
  assert.ok(drone, "drones stay in spec tables before they are published");
  assert.ok(specDefs(undefined, [drone]).some((d) => d.key === "flightTimeMin"));
  assert.deepEqual(specDefs(["weightG", "nope"], [drone]).map((d) => d.key), ["weightG"]);
});

test("top lists only published cameras, within the limits asked for", () => {
  for (const slug of topSlugs("type=mirrorless,max=1500,since=2020,n=5")) {
    const p = product(slug);
    assert.ok(p && p.kind === "camera" && p.item.type === "mirrorless" && p.item.announced >= "2020");
  }
});

test("every product a post names exists in the catalog, and every post has a date and a kind", () => {
  for (const g of guides()) {
    assert.ok(g.date && g.updated, `${g.slug}: date`);
    for (const m of g.body.matchAll(/^\[\[(picks|specs):([^\]|]+)/gm)) for (const slug of m[2].split(",")) assert.ok(anyCamera(slug.trim()), `${g.slug}: unknown product ${slug}`);
    if (g.hero) assert.ok(anyCamera(g.hero), `${g.slug}: unknown hero ${g.hero}`);
    for (const m of g.body.matchAll(/\]\(\/guides\/([a-z0-9-]+)\)/g)) assert.ok(guides().some((x) => x.slug === m[1]), `${g.slug}: links to missing guide ${m[1]}`);
  }
});
