import assert from "node:assert/strict";
import { test } from "node:test";
import { affiliateUrl, isPaid, subId } from "../src/lib/affiliate";

const withEnv = (vars: Record<string, string>, fn: () => void) => {
  const old = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  Object.assign(process.env, vars);
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(old)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
};

test("unconfigured programmes leave links untouched and unmarked", () => {
  withEnv({ AMAZON_ASSOCIATE_TAG: "", EBAY_AFFILIATE_CAMPAIGN: "", AFFILIATE_DEEPLINK_BH: "" }, () => {
    assert.equal(affiliateUrl("amazon", "https://www.amazon.com/dp/B000000000", "x"), "https://www.amazon.com/dp/B000000000");
    assert.equal(affiliateUrl("bh", "https://www.bhphotovideo.com/c/product/1", "x"), "https://www.bhphotovideo.com/c/product/1");
    assert.equal(isPaid("amazon"), false);
  });
});

test("Amazon gets tag and ascsubtag; eBay gets the EPN parameters", () => {
  withEnv({ AMAZON_ASSOCIATE_TAG: "camcompare-20", EBAY_AFFILIATE_CAMPAIGN: "123" }, () => {
    const a = new URL(affiliateUrl("amazon", "https://www.amazon.com/dp/B000000000", "cc-cam-offers"));
    assert.equal(a.searchParams.get("tag"), "camcompare-20");
    assert.equal(a.searchParams.get("ascsubtag"), "cc-cam-offers");
    const e = new URL(affiliateUrl("ebay", "https://www.ebay.com/itm/1", "cc-cam-offers"));
    assert.equal(e.searchParams.get("campid"), "123");
    assert.equal(e.searchParams.get("mkevt"), "1");
    assert.equal(e.searchParams.get("customid"), "cc-cam-offers");
  });
});

test("network deep-link templates wrap the retailer's own links only", () => {
  withEnv({ AFFILIATE_DEEPLINK_ADORAMA: "https://adorama.example/c/1?u={url}&subId1={subid}" }, () => {
    assert.equal(
      affiliateUrl("adorama", "https://www.adorama.com/isca7m4.html", "cc-x"),
      `https://adorama.example/c/1?u=${encodeURIComponent("https://www.adorama.com/isca7m4.html")}&subId1=cc-x`,
    );
    // Already a tracking link from the feed: leave it alone.
    assert.equal(affiliateUrl("adorama", "https://www.anrdoezrs.net/click-1-2", "cc-x"), "https://www.anrdoezrs.net/click-1-2");
    assert.equal(isPaid("adorama"), true);
  });
});

test("sub-ids are short and safe", () => {
  assert.equal(subId("cam-sony-a7-iv", "offers"), "cc-cam-sony-a7-iv-offers");
  assert.ok(subId("x".repeat(100), "y").length <= 60);
});
