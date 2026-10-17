import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AUTH_SECRET_MIN,
  authSecret,
  clearedCookies,
  hashToken,
  ipKey,
  isRawToken,
  LOGIN_TTL_MS,
  loginExpiry,
  loginTokenUsable,
  newRawToken,
  readCookie,
  sameOrigin,
  sessionCookies,
  signSession,
  verifySessionCookie,
} from "../src/lib/community/auth";
import { noticeVerdict, NOTICE_CAPS } from "../src/lib/community/notify";
import {
  applyVote,
  CAMEXPERT_KARMA,
  CAMEXPERT_MIN_ACCOUNT_DAYS,
  checkUsername,
  DEAL_KEYS_MAX,
  isCamExpert,
  karmaOf,
  linkSegments,
  nextVote,
  parseDealKeys,
  parseTarget,
  sanitizeLine,
  sanitizeText,
  targetKey,
} from "../src/lib/community/rules";
import { commentInput, moderateInput, reportInput, reviewInput, signInInput, sitePath, threadInput, voteInput } from "../src/lib/community/validate";

const DAY = 86_400_000;
const SECRET = "x".repeat(AUTH_SECRET_MIN);

// ---------------------------------------------------------------- karma and badge

test("CamKarma counts votes on comments and reviews only, never deal or thread votes", () => {
  assert.equal(
    karmaOf([
      { kind: "comment", value: 1 },
      { kind: "comment", value: 1 },
      { kind: "review", value: -1 },
      { kind: "deal", value: 1 },
      { kind: "thread", value: 1 },
    ]),
    1,
  );
  assert.equal(karmaOf([{ kind: "comment", value: 5 }]), 0, "only ±1 votes exist");
});

test("CamExpert needs the karma threshold and an account old enough", () => {
  const now = Date.parse("2026-10-17T00:00:00Z");
  const old = new Date(now - CAMEXPERT_MIN_ACCOUNT_DAYS * DAY).toISOString();
  const young = new Date(now - (CAMEXPERT_MIN_ACCOUNT_DAYS * DAY - 1)).toISOString();
  assert.equal(isCamExpert(CAMEXPERT_KARMA, old, now), true);
  assert.equal(isCamExpert(CAMEXPERT_KARMA - 1, old, now), false);
  assert.equal(isCamExpert(CAMEXPERT_KARMA * 10, young, now), false);
  assert.equal(isCamExpert(CAMEXPERT_KARMA, null, now), false);
  assert.equal(isCamExpert(CAMEXPERT_KARMA, "not a date", now), false);
});

// ---------------------------------------------------------------- votes

test("vote toggle: same arrow removes, the other switches", () => {
  assert.equal(nextVote(0, 1), 1);
  assert.equal(nextVote(1, 1), 0);
  assert.equal(nextVote(1, -1), -1);
  assert.equal(nextVote(-1, -1), 0);
  assert.equal(nextVote(-1, 1), 1);
  assert.equal(applyVote(10, 0, 1), 11);
  assert.equal(applyVote(10, 1, -1), 8);
  assert.equal(applyVote(10, -1, 0), 11);
  assert.equal(applyVote(10, 1, 1), 10);
});

test("vote input: ±1 or 0, ids for posts and deal keys for deals", () => {
  assert.ok(voteInput.safeParse({ kind: "comment", target: "12", value: 1 }).success);
  assert.ok(voteInput.safeParse({ kind: "deal", target: "us:sony-a7-iv:used", value: -1 }).success);
  assert.ok(voteInput.safeParse({ kind: "review", target: 7, value: 0 }).success);
  assert.ok(!voteInput.safeParse({ kind: "comment", target: "us:sony", value: 1 }).success);
  assert.ok(!voteInput.safeParse({ kind: "deal", target: "US Deal!", value: 1 }).success);
  assert.ok(!voteInput.safeParse({ kind: "comment", target: "1", value: 2 }).success);
  assert.ok(!voteInput.safeParse({ kind: "user", target: "1", value: 1 }).success);
});

// ---------------------------------------------------------------- targets

test("targets: product, deal and thread keys only", () => {
  assert.deepEqual(parseTarget("product:sony-a7-iv"), { kind: "product", slug: "sony-a7-iv" });
  assert.deepEqual(parseTarget("deal:us:sony-a7-iv:used"), { kind: "deal", key: "us:sony-a7-iv:used" });
  assert.deepEqual(parseTarget("thread:42"), { kind: "thread", id: "42" });
  for (const bad of ["product:Sony A7", "thread:0", "thread:abc", "user:1", "product:", "nope", "product:../x", 5, null]) assert.equal(parseTarget(bad), null, String(bad));
  assert.equal(targetKey(parseTarget("thread:42")!), "thread:42");
});

test("deal keys from a comma list: valid, unique, capped", () => {
  assert.deepEqual(parseDealKeys("a,b,a, c ,BAD KEY,,d!"), ["a", "b", "c"]);
  const many = Array.from({ length: DEAL_KEYS_MAX + 50 }, (_, i) => `k${i}`).join(",");
  assert.equal(parseDealKeys(many).length, DEAL_KEYS_MAX);
  assert.deepEqual(parseDealKeys(null), []);
});

// ---------------------------------------------------------------- text

test("sanitizeText strips HTML, control and bidi characters, keeps line breaks", () => {
  assert.equal(sanitizeText("<b>Great</b> lens<script>alert(1)</script>"), "Great lens");
  assert.equal(sanitizeText('<img src=x onerror="alert(1)">hi'), "hi");
  assert.equal(sanitizeText("line one\r\nline two\n\n\n\nline three  "), "line one\nline two\n\nline three");
  assert.equal(sanitizeText("a\u0000b‮c​d"), "abcd");
  assert.equal(sanitizeText("<!-- x -->ok"), "ok");
  assert.equal(sanitizeText("5 < 6 and 7 > 3"), "5 < 6 and 7 > 3", "comparisons aren't tags");
  assert.equal(sanitizeText("I <3 this"), "I <3 this");
  assert.equal(sanitizeText(42), "");
  assert.equal(sanitizeLine("  a\n\n b\tc "), "a b c");
});

test("linkSegments: only http(s) links, trailing punctuation left out", () => {
  const s = linkSegments("See https://example.com/a_(b), then javascript:alert(1) or www.x.com.");
  assert.deepEqual(s[0], { type: "text", text: "See " });
  assert.equal(s[1].type, "link");
  if (s[1].type === "link") assert.equal(s[1].href, "https://example.com/a_(b)");
  assert.ok(s.slice(2).every((x) => x.type === "text"), "javascript: and bare hosts are text");
  assert.equal(linkSegments("(https://a.example/x)").find((x) => x.type === "link")?.text, "https://a.example/x");
  assert.equal(linkSegments("http://localhost/x").filter((x) => x.type === "link").length, 0);
  const long = linkSegments(`https://example.com/${"a".repeat(100)}`)[0];
  assert.ok(long.type === "link" && long.text.length <= 60 && long.href.length > 100);
});

// ---------------------------------------------------------------- validation

test("comment input: cleaned before length checks, capped", () => {
  const ok = commentInput.safeParse({ target: "product:sony-a7-iv", body: " <p>Nice</p> ", parentId: "5" });
  assert.ok(ok.success);
  if (ok.success) assert.deepEqual([ok.data.body, ok.data.parentId], ["Nice", "5"]);
  assert.ok(!commentInput.safeParse({ target: "product:sony-a7-iv", body: "<b></b>" }).success, "nothing left after stripping");
  assert.ok(!commentInput.safeParse({ target: "product:sony-a7-iv", body: "x".repeat(4001) }).success);
  assert.ok(!commentInput.safeParse({ target: "elsewhere:1", body: "hi" }).success);
  assert.ok(!commentInput.safeParse({ target: "thread:1", body: "hi", parentId: "-1" }).success);
});

test("review, thread, report and sign-in inputs", () => {
  assert.ok(reviewInput.safeParse({ product: "sony-a7-iv", rating: 5, body: "A great all-round body for stills." }).success);
  assert.ok(!reviewInput.safeParse({ product: "sony-a7-iv", rating: 6, body: "A great all-round body for stills." }).success);
  assert.ok(!reviewInput.safeParse({ product: "sony-a7-iv", rating: 4.5, body: "A great all-round body for stills." }).success);
  assert.ok(!reviewInput.safeParse({ product: "sony-a7-iv", rating: 4, body: "too short" }).success);
  const t = threadInput.safeParse({ board: "gear-advice", title: "  Which\nlens  for <i>street</i>? ", body: "" });
  assert.ok(t.success);
  if (t.success) assert.equal(t.data.title, "Which lens for street?");
  assert.ok(!threadInput.safeParse({ board: "photos", title: "A good title", body: "" }).success);
  assert.ok(!threadInput.safeParse({ board: "general", title: "hey", body: "" }).success);
  assert.ok(reportInput.safeParse({ kind: "comment", id: "3", reason: "spam" }).success);
  assert.ok(!reportInput.safeParse({ kind: "deal", id: "3", reason: "spam" }).success);
  const e = signInInput.safeParse({ email: " Me@Example.COM " });
  assert.ok(e.success && e.data.email === "me@example.com");
  assert.ok(!signInInput.safeParse({ email: "nope" }).success);
  assert.ok(moderateInput.safeParse({ action: "ban", kind: "user", id: "9" }).success);
  assert.ok(!moderateInput.safeParse({ action: "drop", kind: "user", id: "9" }).success);
});

test("sitePath keeps sign-in redirects on this site", () => {
  assert.equal(sitePath("/cameras/x#discussion"), "/cameras/x#discussion");
  for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "/a b", "", 3]) assert.equal(sitePath(bad), null, String(bad));
});

test("usernames: shape, reserved names, case-insensitive key", () => {
  const ok = checkUsername("  Street_Shooter ");
  assert.ok(ok.ok && ok.username === "Street_Shooter" && ok.lower === "street_shooter");
  for (const bad of ["ab", "a".repeat(21), "1abc", "has space", "émile", "admin", "Moderator", "CamCompareFan", "x-y"]) assert.equal(checkUsername(bad).ok, false, bad);
});

// ---------------------------------------------------------------- tokens and sessions

test("login tokens: random, stored hashed, single-use and 15 minutes", () => {
  const a = newRawToken();
  assert.ok(isRawToken(a) && a !== newRawToken());
  assert.match(hashToken(a), /^[0-9a-f]{64}$/);
  assert.notEqual(hashToken(a), a);
  assert.equal(hashToken(a), hashToken(a));
  assert.equal(LOGIN_TTL_MS, 15 * 60_000);
  const now = Date.parse("2026-10-17T12:00:00Z");
  const exp = loginExpiry(now);
  assert.equal(loginTokenUsable({ expiresAt: exp, usedAt: null }, now + LOGIN_TTL_MS - 1), true);
  assert.equal(loginTokenUsable({ expiresAt: exp, usedAt: null }, now + LOGIN_TTL_MS), false, "expired");
  assert.equal(loginTokenUsable({ expiresAt: exp, usedAt: new Date(now) }, now + 1), false, "used");
});

test("session cookies: HMAC-signed, tamper-evident, httpOnly Secure Lax", () => {
  const raw = newRawToken();
  const v = signSession(raw, SECRET);
  assert.equal(verifySessionCookie(v, SECRET), raw);
  assert.equal(verifySessionCookie(v, "y".repeat(AUTH_SECRET_MIN)), null, "another secret");
  assert.equal(verifySessionCookie(`${newRawToken()}.${v.split(".")[1]}`, SECRET), null, "swapped token");
  assert.equal(verifySessionCookie(raw, SECRET), null, "unsigned");
  assert.equal(verifySessionCookie(v, null), null, "no secret configured");
  const [session, hint] = sessionCookies(v, { secure: true });
  assert.match(session, /^cc_session=.+; Path=\/; Max-Age=\d+; HttpOnly; SameSite=Lax; Secure$/);
  assert.doesNotMatch(hint, /HttpOnly/);
  assert.ok(clearedCookies({ secure: true }).every((c) => c.includes("Max-Age=0")));
  assert.equal(readCookie(`a=1; cc_session=${encodeURIComponent(v)}; b=2`, "cc_session"), v);
  assert.equal(readCookie("a=1", "cc_session"), null);
});

test("AUTH_SECRET shorter than the minimum switches sign-in off", () => {
  assert.equal(authSecret(undefined), null);
  assert.equal(authSecret("short"), null);
  assert.equal(authSecret(` ${SECRET} `), SECRET);
  assert.notEqual(ipKey("1.2.3.4", SECRET), "1.2.3.4");
  assert.equal(ipKey("1.2.3.4", SECRET), ipKey("1.2.3.4", SECRET));
});

test("same-origin guard on writes", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  const url = "https://www.camcompare.app/api/community/comments";
  assert.equal(sameOrigin(h({ origin: "https://www.camcompare.app" }), url), true);
  assert.equal(sameOrigin(h({ origin: "http://localhost:3000", "sec-fetch-site": "same-origin" }), "http://localhost:3000/api/x", []), true);
  assert.equal(sameOrigin(h({ origin: "https://evil.example" }), url), false);
  assert.equal(sameOrigin(h({}), url), false, "no Origin");
  assert.equal(sameOrigin(h({ origin: "null" }), url), false);
  assert.equal(sameOrigin(h({ origin: "https://www.camcompare.app", "sec-fetch-site": "cross-site" }), url), false);
});

test("owner notices stop at the daily cap and say so on the last one", () => {
  const cap = NOTICE_CAPS.report;
  assert.equal(noticeVerdict("report", 1), "send");
  assert.equal(noticeVerdict("report", cap - 1), "send");
  assert.equal(noticeVerdict("report", cap), "send-last");
  assert.equal(noticeVerdict("report", cap + 1), "skip");
});
