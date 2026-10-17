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
  withEnv({ AMAZON_TAG_US: "", AMAZON_ASSOCIATE_TAG: "", EBAY_AFFILIATE_CAMPAIGN: "", AFFILIATE_DEEPLINK_BH: "" }, () => {
    assert.equal(affiliateUrl("amazon", "https://www.amazon.com/dp/B000000000", "x"), "https://www.amazon.com/dp/B000000000");
    assert.equal(affiliateUrl("bh", "https://www.bhphotovideo.com/c/product/1", "x"), "https://www.bhphotovideo.com/c/product/1");
    assert.equal(isPaid("amazon"), false);
  });
});

test("each Amazon marketplace gets its own tag, and only on its own domain", () => {
  withEnv({ AMAZON_TAG_US: "cc-20", AMAZON_TAG_UK: "cc-21" }, () => {
    const us = new URL(affiliateUrl("amazon", "https://www.amazon.com/dp/B000000000", "cc-cam"));
    assert.equal(us.searchParams.get("tag"), "cc-20");
    assert.equal(us.searchParams.get("ascsubtag"), "cc-cam");
    const uk = new URL(affiliateUrl("amazon-gb", "https://www.amazon.co.uk/dp/B000000000", "cc-cam"));
    assert.equal(uk.searchParams.get("tag"), "cc-21");
    assert.equal(affiliateUrl("amazon-gb", "https://www.amazon.com/dp/B000000000", "x"), "https://www.amazon.com/dp/B000000000");
    assert.equal(isPaid("amazon-de"), false);
  });
});

test("the legacy AMAZON_ASSOCIATE_TAG still tags US links", () => {
  withEnv({ AMAZON_TAG_US: "", AMAZON_ASSOCIATE_TAG: "old-20" }, () => {
    assert.equal(new URL(affiliateUrl("amazon", "https://www.amazon.com/dp/B000000000", "x")).searchParams.get("tag"), "old-20");
  });
});

test("eBay links get the EPN parameters with each site's rotation id", () => {
  withEnv({ EBAY_AFFILIATE_CAMPAIGN: "123" }, () => {
    const us = new URL(affiliateUrl("ebay", "https://www.ebay.com/itm/1", "cc-cam"));
    assert.equal(us.searchParams.get("campid"), "123");
    assert.equal(us.searchParams.get("mkrid"), "711-53200-19255-0");
    assert.equal(us.searchParams.get("customid"), "cc-cam");
    const uk = new URL(affiliateUrl("ebay-gb", "https://www.ebay.co.uk/itm/1", "cc-cam"));
    assert.equal(uk.searchParams.get("mkrid"), "710-53481-19255-0");
    assert.equal(uk.searchParams.get("siteid"), "3");
  });
});

test("network deep-link templates wrap the retailer's own links only", () => {
  withEnv({ AFFILIATE_DEEPLINK_ADORAMA: "https://adorama.example/c/1?u={url}&subId1={subid}" }, () => {
    assert.equal(
      affiliateUrl("adorama", "https://www.adorama.com/isca7m4.html", "cc-x"),
      `https://adorama.example/c/1?u=${encodeURIComponent("https://www.adorama.com/isca7m4.html")}&subId1=cc-x`,
    );
    assert.equal(affiliateUrl("adorama", "https://www.anrdoezrs.net/click-1-2", "cc-x"), "https://www.anrdoezrs.net/click-1-2");
    assert.equal(isPaid("adorama"), true);
  });
});

test("retailer keys with dashes map to underscore env names", () => {
  withEnv({ AFFILIATE_DEEPLINK_MPB_UK: "https://www.awin1.com/cread.php?awinmid=1&awinaffid=2&clickref={subid}&ued={url}" }, () => {
    assert.ok(affiliateUrl("mpb-uk", "https://www.mpb.com/en-uk/product/x", "cc").startsWith("https://www.awin1.com/"));
  });
});

test("append-style programmes add their parameters to the retailer's own URL", () => {
  withEnv({ AFFILIATE_DEEPLINK_BH: "&BI=1234&KBID=5678" }, () => {
    const u = new URL(affiliateUrl("bh", "https://www.bhphotovideo.com/c/product/1?sku=9", "cc-x"));
    assert.equal(u.searchParams.get("BI"), "1234");
    assert.equal(u.searchParams.get("KBID"), "5678");
    assert.equal(u.searchParams.get("sku"), "9");
    assert.equal(isPaid("bh"), true);
  });
  withEnv({ AFFILIATE_DEEPLINK_BH: "nonsense" }, () => assert.equal(isPaid("bh"), false));
});

test("sub-ids are short and safe", () => {
  assert.equal(subId("cam-sony-a7-iv", "offers"), "cc-cam-sony-a7-iv-offers");
  assert.ok(subId("x".repeat(100), "y").length <= 60);
});
