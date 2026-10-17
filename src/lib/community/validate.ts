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
  kind: z.enum(["comment", "review", "thread"]),
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
  kind: z.enum(["comment", "review", "thread", "user"]),
  id,
});

/** A site path only ("/cameras/x"): never another host or a "//host" URL. */
export const sitePath = (p: unknown): string | null =>
  typeof p === "string" && p.startsWith("/") && !p.startsWith("//") && !p.startsWith("/\\") && p.length <= 300 && !/[\s\u0000-\u001f]/.test(p) ? p : null;

/** The first problem as one sentence for the form, or a generic one when it's a field people don't type. */
export function firstError(e: z.ZodError, typed: string[] = ["body", "title", "rating", "email", "note"]): string {
  const issue = e.issues[0];
  return issue && typed.includes(String(issue.path[0])) ? issue.message : "Something in the form isn't right. Please check it and try again.";
}
