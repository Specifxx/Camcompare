// The request board (/requests): members post feature and gear requests
// ("track this store", "add this camera"), vote them up or down, and the
// owner sets a status from /admin. Pure and client-safe: kinds, statuses,
// limits and the shape the API returns. The private feedback form
// (/feedback) stays; this is its public, votable companion.
import type { Author } from "./rules";

export const REQUEST_KINDS = [
  { slug: "feature", label: "Feature" },
  { slug: "gear", label: "Add a camera or lens" },
  { slug: "store", label: "Track a store" },
  { slug: "other", label: "Other" },
] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number]["slug"];
export const REQUEST_KIND_SLUGS = REQUEST_KINDS.map((k) => k.slug) as [RequestKind, ...RequestKind[]];
export const requestKindLabel = (s: string) => REQUEST_KINDS.find((k) => k.slug === s)?.label ?? s;

export const REQUEST_STATUSES = [
  { slug: "open", label: "Open" },
  { slug: "planned", label: "Planned" },
  { slug: "done", label: "Done" },
  { slug: "wont", label: "Won't do" },
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number]["slug"];
export const REQUEST_STATUS_SLUGS = REQUEST_STATUSES.map((s) => s.slug) as [RequestStatus, ...RequestStatus[]];
export const isRequestStatus = (s: unknown): s is RequestStatus => typeof s === "string" && (REQUEST_STATUS_SLUGS as readonly string[]).includes(s);
export const requestStatusLabel = (s: string) => REQUEST_STATUSES.find((x) => x.slug === s)?.label ?? s;

export const REQUEST_TITLE_MIN = 8;
export const REQUEST_TITLE_MAX = 140;
export const REQUEST_BODY_MAX = 2000;
export const REQUEST_NOTE_MAX = 300;
/** New requests per member per day, across instances. */
export const REQUESTS_PER_DAY = 5;

export type RequestItem = {
  id: string;
  createdAt: string;
  editedAt: string | null;
  kind: RequestKind;
  title: string;
  body: string;
  status: RequestStatus;
  /** The owner's one-line note with the status ("Coming in November"). */
  statusNote: string | null;
  statusAt: string | null;
  author: Author | null;
  score: number;
  comments: number;
};
