import assert from "node:assert/strict";
import { test } from "node:test";
import { subId } from "../src/lib/affiliate";
import { accessoryEbayCategory, ebayCategoryLinks, ebayLink, ebayRelatedLinks, ebaySearchUrl, ebayTemplate, productEbayLinks } from "../src/lib/ebay-links";
import { EBAY_QUERY_SLOT, fillEbay } from "../src/lib/ebay-template";
import { MARKET_CODES } from "../src/lib/markets";

const q = (href: string) => new URL(href).searchParams;

test("eBay condition and sold filters use eBay's own parameters", () => {
  const used = q(ebaySearchUrl("us", { query: "Sony α7 IV", condition: "used" })!);
  assert.equal(used.get("_nkw"), "Sony a7 IV");
  assert.equal(used.get("_sacat"), "625");
  assert.equal(used.get("LH_ItemCondition"), "3000");
  assert.equal(q(ebaySearchUrl("us", { query: "x", condition: "new" })!).get("LH_ItemCondition"), "1000");
  const sold = q(ebaySearchUrl("uk", { query: "x", sold: true })!);
  assert.equal(sold.get("LH_Sold"), "1");
  assert.equal(sold.get("LH_Complete"), "1");
  assert.equal(sold.get("LH_ItemCondition"), null);
  assert.equal(q(ebaySearchUrl("us", { query: "x", category: null })!).get("_sacat"), null);
});

test("every eBay link carries the owner's campaign, the site's rotation id and its placement", () => {
  const rot = { us: "711-53200-19255-0", uk: "710-53481-19255-0", eu: "707-53477-19255-0", au: "705-53470-19255-0" } as const;
  const host = { us: "www.ebay.com", uk: "www.ebay.co.uk", eu: "www.ebay.de", au: "www.ebay.com.au" } as const;
  for (const m of ["us", "uk", "eu", "au"] as const) {
    const l = productEbayLinks("Sony a7 IV", "Sony a7 IV", m, `cam-${m}-sony-a7-iv`, "product")!;
    for (const [kind, link] of [["used", l.used], ["new", l.new], ["sold", l.sold]] as const) {
      const p = q(link.href);
      assert.equal(new URL(link.href).host, host[m]);
      assert.equal(p.get("campid"), "5339155912");
      assert.equal(p.get("mkrid"), rot[m]);
      assert.equal(p.get("customid"), `cc-cam-${m}-sony-a7-iv-product-ebay-${kind}`);
      assert.equal(link.paid, true);
    }
  }
});

test("Singapore has no eBay programme: no eBay link anywhere", () => {
  assert.equal(ebaySearchUrl("sg", { query: "x" }), null);
  assert.equal(productEbayLinks("x", "x", "sg", "p", "product"), null);
  assert.equal(ebayTemplate("sg", { sold: true }, "p", "gear-ebay-sold"), null);
  assert.deepEqual(ebayCategoryLinks("sg", "home-sg", "home-ebay"), []);
  assert.deepEqual(ebayRelatedLinks("sg", "p", "promo-product", { brand: "Sony", mountName: "Sony E-mount", kind: "camera" }), []);
  for (const m of MARKET_CODES) if (m !== "sg") assert.ok(ebayCategoryLinks(m, `home-${m}`, "home-ebay").length === 4);
});

test("accessory sections narrow to eBay US categories, Cameras & Photo elsewhere, none for drives", () => {
  assert.equal(accessoryEbayCategory("tripods", "us"), 30090);
  assert.equal(accessoryEbayCategory("tripods", "uk"), 625);
  assert.equal(accessoryEbayCategory("cages", "us"), 625);
  assert.equal(accessoryEbayCategory("storage", "us"), null);
  const l = ebayLink("us", { query: "tripod", category: accessoryEbayCategory("tripods", "us") }, "acc-us-tripods", "acc-ebay", "x")!;
  assert.equal(q(l.href).get("_sacat"), "30090");
  assert.equal(q(l.href).get("customid"), "cc-acc-us-tripods-acc-ebay");
});

test("a template keeps its tags and takes the search words in the browser", () => {
  const t = ebayTemplate("au", { category: 625 }, "acc-au-cages", "acc-ebay-camera")!;
  assert.ok(t.href.includes(EBAY_QUERY_SLOT));
  const href = fillEbay(t.href, "SmallRig cage for Sony α7 IV");
  const p = q(href);
  assert.equal(p.get("_nkw"), "SmallRig cage for Sony a7 IV");
  assert.equal(p.get("campid"), "5339155912");
  assert.equal(p.get("mkrid"), "705-53470-19255-0");
  assert.equal(p.get("customid"), "cc-acc-au-cages-acc-ebay-camera");
  const sold = q(fillEbay(ebayTemplate("us", { sold: true }, "gear-us", "gear-ebay-sold")!.href, "Fujifilm X100VI"));
  assert.equal(sold.get("LH_Sold"), "1");
  assert.equal(sold.get("_nkw"), "Fujifilm X100VI");
});

test("a long page name is cut, never the placement", () => {
  const s = subId(`cam-us-${"very-long-product-slug-".repeat(4)}`, "product-ebay-used");
  assert.ok(s.length <= 60);
  assert.ok(s.endsWith("-product-ebay-used"), s);
  assert.equal(subId("cam-sony-a7-iv", "offers"), "cc-cam-sony-a7-iv-offers");
});

test("the product page promo names the maker and the mount", () => {
  const labels = ebayRelatedLinks("us", "cam-us-x", "promo-product", { brand: "Sony", mountName: "Sony E-mount", kind: "camera" }).map((l) => l.label);
  assert.deepEqual(labels, ["Used Sony cameras", "Used Sony lenses", "Used Sony E lenses", "Sony cameras: recently sold"]);
  assert.equal(ebayRelatedLinks("us", "p", "x", { brand: "Leica", mountName: "L-Mount", kind: "lens" })[1].label, "Used L-Mount lenses");
});
