// What a feedback message can be about, and the limits the form and the API
// share. Client-safe: no Node imports (the server half is lib/feedback.ts).

export const FEEDBACK_KINDS = ["bug", "price", "missing", "idea", "other"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const KIND_LABEL: Record<FeedbackKind, string> = {
  bug: "Bug",
  price: "Wrong price or spec",
  missing: "Missing product",
  idea: "Idea",
  other: "Other",
};

export const KIND_PROMPT: Record<FeedbackKind, string> = {
  bug: "What went wrong, and what did you expect to happen?",
  price: "Which product, which price or spec, and what is right?",
  missing: "Which camera or lens should we add?",
  idea: "What would make CamCompare more useful to you?",
  other: "Tell us anything.",
};

export const MESSAGE_MIN = 5;
export const MESSAGE_MAX = 4000;
export const EMAIL_MAX = 254;
export const PAGE_MAX = 500;
/** A form sent sooner than this after it opened is a bot (or a paste-and-send; the form asks to try again). */
export const MIN_FILL_MS = 3000;

// The page a visitor was on before opening /feedback. The floating button
// lives in the root layout, so it sees every client-side navigation and notes
// the last real page here; the /feedback form reports that page instead of
// "/feedback". A hard load of /feedback has none: it reports itself.
let lastPage: string | null = null;
export const rememberPage = (p: string) => void (lastPage = p.slice(0, PAGE_MAX));
export const rememberedPage = () => lastPage;

/** The floating button stays off these pages: /feedback has the full form, /admin is the owner's. */
export const isFeedbackHiddenPath = (pathname: string) => /^\/(feedback|admin)(\/|$)/.test(pathname);
