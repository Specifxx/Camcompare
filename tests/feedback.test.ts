import assert from "node:assert/strict";
import { test } from "node:test";
import { POST } from "../src/app/api/feedback/route";
import robots from "../src/app/robots";
import { adminKeyMatches, adminSessionToken, adminSessionValid, checkSubmission, clientIp, createRateLimiter, USER_AGENT_MAX } from "../src/lib/feedback";
import { isFeedbackHiddenPath, MESSAGE_MAX, MIN_FILL_MS } from "../src/lib/feedback-kinds";

const ok = { kind: "price", message: "The a7 IV used price looks wrong", email: "", page: "/uk/cameras/sony-a7-iv?x=1", market: "uk", elapsedMs: 8000, website: "" };

test("a good message is stored, cleaned and capped", () => {
  const v = checkSubmission({ ...ok, message: "  Wrong\u0000 price  ", email: " me@example.com " }, "Mozilla/5.0 " + "x".repeat(1000));
  assert.equal(v.action, "store");
  if (v.action !== "store") return;
  assert.deepEqual({ ...v.row, userAgent: v.row.userAgent?.length }, { kind: "price", message: "Wrong price", email: "me@example.com", page: "/uk/cameras/sony-a7-iv?x=1", market: "uk", userAgent: USER_AGENT_MAX });
  // Optional fields: no email is null, an unknown kind-less message is "other", a junk market is dropped.
  const bare = checkSubmission({ message: "Add the Nikon Zf please", elapsedMs: 5000, market: "mars" });
  assert.equal(bare.action, "store");
  if (bare.action === "store") assert.deepEqual([bare.row.kind, bare.row.email, bare.row.page, bare.row.market, bare.row.userAgent], ["other", null, null, null, null]);
});

test("validation refuses short, long, malformed and off-site input", () => {
  const status = (body: unknown) => {
    const v = checkSubmission(body);
    return v.action === "reject" ? v.status : v.action;
  };
  assert.equal(status({ ...ok, message: "hey " }), 400);
  assert.equal(status({ ...ok, message: "x".repeat(MESSAGE_MAX + 1) }), 400);
  assert.equal(status({ ...ok, message: "x".repeat(MESSAGE_MAX) }), "store");
  assert.equal(status({ ...ok, email: "not-an-email" }), 400);
  assert.equal(status({ ...ok, email: `${"a".repeat(250)}@example.com` }), 400);
  assert.equal(status({ ...ok, kind: "spam" }), 400);
  assert.equal(status({ ...ok, page: "x".repeat(501) }), 400);
  assert.equal(status(null), 400);
  assert.equal(status("message"), 400);
  const msg = checkSubmission({ ...ok, message: "hi" });
  assert.ok(msg.action === "reject" && /at least 5/.test(msg.error));
  // A page that isn't a path on this site is kept out of the admin page's links.
  for (const page of ["//evil.example/x", "https://evil.example", "/\\evil.example", "javascript:alert(1)"]) {
    const v = checkSubmission({ ...ok, page });
    assert.ok(v.action === "store" && v.row.page === null, page);
  }
});

test("the honeypot drops silently and a form sent too fast is refused", () => {
  assert.deepEqual(checkSubmission({ ...ok, website: "https://spam.example" }), { action: "drop" });
  for (const elapsedMs of [undefined, 0, MIN_FILL_MS - 1]) {
    const v = checkSubmission({ ...ok, elapsedMs });
    assert.ok(v.action === "reject" && v.status === 422, String(elapsedMs));
  }
  assert.equal(checkSubmission({ ...ok, elapsedMs: MIN_FILL_MS }).action, "store");
  assert.equal(checkSubmission({ ...ok, elapsedMs: -5 }).action, "reject");
});

test("the rate limit allows a few per window per IP, then says when to retry", () => {
  const rl = createRateLimiter({ limit: 3, windowMs: 60_000, maxKeys: 10 });
  const t = 1_000_000;
  for (let i = 0; i < 3; i++) assert.deepEqual(rl.hit("1.2.3.4", t + i), { ok: true });
  assert.deepEqual(rl.hit("1.2.3.4", t + 10_000), { ok: false, retryAfterS: 50 });
  assert.deepEqual(rl.hit("5.6.7.8", t + 10_000), { ok: true });
  assert.deepEqual(rl.hit("1.2.3.4", t + 60_001), { ok: true }); // the first hit left the window
  // The table can't grow without bound: stale keys go first.
  for (let i = 0; i < 20; i++) rl.hit(`k${i}`, t + 200_000 + i);
  assert.ok(rl.size() <= 11);
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" })), "9.9.9.9");
  assert.equal(clientIp(new Headers({ "x-real-ip": "8.8.8.8", "x-forwarded-for": "9.9.9.9" })), "8.8.8.8");
  assert.equal(clientIp(new Headers()), "unknown");
});

test("the admin key must match exactly, and a short or missing key opens nothing", () => {
  const key = "Zq8vN3tP7wXk2LmR5sYd9HbC4fJg6Ae1";
  assert.equal(adminKeyMatches(key, key), true);
  assert.equal(adminKeyMatches(key, `  ${key}\n`), true); // pasted with whitespace
  assert.equal(adminKeyMatches(encodeURIComponent(key), key), true);
  assert.equal(adminKeyMatches(key.slice(0, -1), key), false);
  assert.equal(adminKeyMatches(`${key}x`, key), false);
  assert.equal(adminKeyMatches(key.toLowerCase(), key), false);
  assert.equal(adminKeyMatches("", key), false);
  assert.equal(adminKeyMatches(undefined, key), false);
  assert.equal(adminKeyMatches("%E0%A4%A", key), false); // malformed escape: no throw
  for (const unset of [undefined, "", "   "]) assert.equal(adminKeyMatches("", unset), false);
  assert.equal(adminKeyMatches("short-key", "short-key"), false);
  // The session cookie: valid for this key only.
  const token = adminSessionToken(key);
  assert.ok(token && !token.includes(key));
  assert.equal(adminSessionValid(token, key), true);
  assert.equal(adminSessionValid(token, `${key}-rotated`), false);
  assert.equal(adminSessionValid(undefined, key), false);
  assert.equal(adminSessionValid("", key), false);
  assert.equal(adminSessionValid(token, undefined), false);
  assert.equal(adminSessionToken("short"), null);
});

test("the API answers 503 without DATABASE_URL, and wants JSON", async () => {
  const prev = process.env.DATABASE_URL;
  const post = (headers: Record<string, string>) => POST(new Request("http://localhost/api/feedback", { method: "POST", headers, body: JSON.stringify(ok) }));
  try {
    delete process.env.DATABASE_URL;
    const res = await post({ "content-type": "application/json" });
    assert.equal(res.status, 503);
    assert.equal(((await res.json()) as { ok: boolean }).ok, false);
    process.env.DATABASE_URL = "postgresql://user:pass@example.invalid/db";
    assert.equal((await post({ "content-type": "text/plain" })).status, 415);
    // The honeypot answers "ok" without touching the database.
    const bot = await POST(new Request("http://localhost/api/feedback", { method: "POST", headers: { "content-type": "application/json", "x-real-ip": "203.0.113.9" }, body: JSON.stringify({ ...ok, website: "x" }) }));
    assert.equal(bot.status, 200);
  } finally {
    if (prev === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prev;
  }
});

test("/admin is Disallowed, and the floating button stays off /feedback and /admin", () => {
  const rules = robots().rules;
  const disallow = (Array.isArray(rules) ? rules : [rules]).flatMap((r) => r.disallow ?? []);
  assert.ok(disallow.includes("/admin"));
  assert.ok(isFeedbackHiddenPath("/feedback") && isFeedbackHiddenPath("/admin") && isFeedbackHiddenPath("/admin/x"));
  assert.ok(!isFeedbackHiddenPath("/") && !isFeedbackHiddenPath("/feedbacks") && !isFeedbackHiddenPath("/uk/cameras"));
});
