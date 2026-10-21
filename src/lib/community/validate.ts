// Input checks for every community write (zod), pure so tests need no
// database. Each schema cleans text with sanitizeText first, then checks the
// length of what is left, so "<b></b>" can't pass as a 7-character comment.
import { z } from "zod";
import {
  BOARD_SLUGS,
  COMMENT_MAX,
  ID_RE,
  REPORT_NOTE_MAX,
  REPORT_REASONS,
  REVIEW_MAX,
  REVIEW_MIN,
  SLUG_RE,
  THREAD_BODY_MAX,
  THREAD_TITLE_MAX,
  THREAD_TITLE_MIN,
  VOTE_KINDS,
  DEAL_KEY_RE,
  parseTarget,
  sanitizeLine,
  sanitizeText,
} from "./rules";
import { EMAIL_MAX } from "../feedback-kinds";
import { COLLECTION_MAX, GEAR_CONDITION_SLUGS, GEAR_ID_RE, GEAR_NOTES_MAX, isIsoDay, PAID_MAX } from "../collection";
import { MARKET_CODES } from "../markets";
import { REQUEST_BODY_MAX, REQUEST_KIND_SLUGS, REQUEST_NOTE_MAX, REQUEST_STATUS_SLUGS, REQUEST_TITLE_MAX, REQUEST_TITLE_MIN } from "./requests";
import { coverUrl, STORY_BODY_MAX, STORY_BODY_MIN, STORY_PRODUCTS_MAX, STORY_TAG_SLUGS, STORY_TAGS_MAX, STORY_TITLE_MAX, STORY_TITLE_MIN, STORY_VERDICT_MAX } from "./stories";

const text = (min: number, max: number, what: string) =>
  z.preprocess(
    sanitizeText,
    z
      .string()
      .min(min, min <= 1 ? `Write something first.` : `Write a little more (at least ${min} characters).`)
      .max(max, `Keep ${what} under ${max} characters.`),
  );

const id = z.union([z.string(), z.number()]).transform(String).pipe(z.string().regex(ID_RE));

export const commentInput = z.object({
  target: z.string().refine((t) => parseTarget(t) !== null, "Unknown discussion."),
  body: text(1, COMMENT_MAX, "a comment"),
  parentId: id.nullable().optional(),
});

export const commentEdit = z.object({ body: text(1, COMMENT_MAX, "a comment") });

export const voteInput = z
  .object({
    kind: z.enum(VOTE_KINDS),
    target: z.union([z.string(), z.number()]).transform(String),
    value: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  })
  .refine((v) => (v.kind === "deal" ? DEAL_KEY_RE.test(v.target) : ID_RE.test(v.target)), { message: "Unknown target.", path: ["target"] });

export const reviewInput = z.object({
  product: z.string().regex(SLUG_RE),
  rating: z.number().int().min(1, "Pick 1 to 5 stars.").max(5, "Pick 1 to 5 stars."),
  body: text(REVIEW_MIN, REVIEW_MAX, "a review"),
});

export const threadInput = z.object({
  board: z.enum(BOARD_SLUGS),
  title: z.preprocess(sanitizeLine, z.string().min(THREAD_TITLE_MIN, `Give it a title of at least ${THREAD_TITLE_MIN} characters.`).max(THREAD_TITLE_MAX, `Keep the title under ${THREAD_TITLE_MAX} characters.`)),
  body: text(0, THREAD_BODY_MAX, "the post"),
});

export const threadEdit = threadInput.pick({ title: true, body: true });

export const reportInput = z.object({
  kind: z.enum(["comment", "review", "thread", "post", "request"]),
  id,
  reason: z.enum(REPORT_REASONS),
  note: z.preprocess(sanitizeText, z.string().max(REPORT_NOTE_MAX)).optional(),
});

export const signInInput = z.object({
  email: z.preprocess((v) => (typeof v === "string" ? v.replace(/\u0000/g, "").trim().toLowerCase() : v), z.string().max(EMAIL_MAX).email("That email doesn't look right.")),
  /** Where to land after signing in: a site path only. */
  next: z.string().max(300).optional(),
  website: z.string().max(300).optional(),
});

export const usernameInput = z.object({ username: z.string().max(40) });

export const moderateInput = z.object({
  action: z.enum(["hide", "unhide", "ban", "unban", "resolve"]),
  kind: z.enum(["comment", "review", "thread", "post", "request", "user"]),
  id,
});

/** A site path only ("/cameras/x"): never another host or a "//host" URL. */
export const sitePath = (p: unknown): string | null =>
  typeof p === "string" && p.startsWith("/") && !p.startsWith("//") && !p.startsWith("/\\") && p.length <= 300 && !/[\s\u0000-\u001f]/.test(p) ? p : null;

/** The first problem as one sentence for the form, or a generic one when it's a field people don't type. */
export function firstError(e: z.ZodError, typed: string[] = ["body", "title", "rating", "email", "note", "verdict", "cover", "tags", "products", "items"]): string {
  const issue = e.issues[0];
  return issue && typed.includes(String(issue.path[0])) ? issue.message : "Something in the form isn't right. Please check it and try again.";
}

// ---------------------------------------------------------------- stories, requests, My gear

const title = (min: number, max: number) =>
  z.preprocess(sanitizeLine, z.string().min(min, `Give it a title of at least ${min} characters.`).max(max, `Keep the title under ${max} characters.`));

/** A member story. Products are catalog slugs (checked against the catalog by the route); the cover is an https image address or nothing. */
export const storyInput = z.object({
  title: title(STORY_TITLE_MIN, STORY_TITLE_MAX),
  body: z.preprocess(
    sanitizeText,
    z.string().min(STORY_BODY_MIN, `A story needs at least ${STORY_BODY_MIN} characters: say what you used it for and how it went.`).max(STORY_BODY_MAX, `Keep the story under ${STORY_BODY_MAX.toLocaleString("en-US")} characters.`),
  ),
  verdict: z.preprocess(sanitizeText, z.string().max(STORY_VERDICT_MAX, `Keep the verdict under ${STORY_VERDICT_MAX} characters.`)).optional(),
  cover: z
    .preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().max(600))
    .optional()
    .refine((v) => !v || coverUrl(v) !== null, "The cover image must be an https:// address of an image (or leave it empty).")
    .transform((v) => (v ? coverUrl(v) : null)),
  tags: z
    .array(z.enum(STORY_TAG_SLUGS))
    .min(1, "Pick at least one tag.")
    .max(STORY_TAGS_MAX, `Pick up to ${STORY_TAGS_MAX} tags.`)
    .transform((t) => [...new Set(t)]),
  products: z
    .array(z.string().regex(SLUG_RE))
    .max(STORY_PRODUCTS_MAX, `Link up to ${STORY_PRODUCTS_MAX} products.`)
    .default([])
    .transform((p) => [...new Set(p)]),
});

export const requestInput = z.object({
  kind: z.enum(REQUEST_KIND_SLUGS),
  title: title(REQUEST_TITLE_MIN, REQUEST_TITLE_MAX),
  body: text(0, REQUEST_BODY_MAX, "the details"),
});

/** The owner's status for a request, from /admin (a plain form post, so strings). */
export const requestStatusInput = z.object({
  id,
  status: z.enum(REQUEST_STATUS_SLUGS),
  note: z.preprocess(sanitizeLine, z.string().max(REQUEST_NOTE_MAX)).optional(),
});

/** The owner's feature switch for a story, from /admin. */
export const featureInput = z.object({ id, featured: z.enum(["1", "0"]).transform((v) => v === "1") });

const gearItem = z.object({
  id: z.string().regex(GEAR_ID_RE),
  slug: z.string().regex(SLUG_RE),
  market: z.enum(MARKET_CODES),
  condition: z.enum(GEAR_CONDITION_SLUGS),
  paid: z.number().int().min(0).max(PAID_MAX).nullable(),
  bought: z.string().refine(isIsoDay).nullable(),
  notes: z.preprocess(sanitizeText, z.string().max(GEAR_NOTES_MAX, `Keep notes under ${GEAR_NOTES_MAX} characters.`)),
  updatedAt: z.string().max(40),
});

/** The whole My gear list, replaced at once. */
export const collectionInput = z.object({ items: z.array(gearItem).max(COLLECTION_MAX, `My gear holds up to ${COLLECTION_MAX} items.`) });
