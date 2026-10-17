"use client";
// Client half of the community: fetch helpers and the signed-in member, shared
// by every community component. Everything loads after the page renders, so
// pages stay static. A signed-out visitor (no cc_member hint cookie) never
// asks /api/community/me at all.
import { useEffect, useState } from "react";
import type { Me } from "@/lib/community/rules";

export type ApiResult<T> = ({ ok: true } & T) | { ok: false; error: string; status: number };

export async function api<T = Record<string, unknown>>(path: string, init?: { method?: string; body?: unknown }): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: init?.method ?? "GET",
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: "same-origin",
    });
    const d = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !d.ok) return { ok: false, status: res.status, error: d.error ?? "Something went wrong. Please try again." };
    return d as { ok: true } & T;
  } catch {
    return { ok: false, status: 0, error: "Couldn't reach the site. Check your connection and try again." };
  }
}

export type MeState = { loaded: boolean; user: Me | null };

const hasHint = () => typeof document !== "undefined" && /(?:^|;\s*)cc_member=1/.test(document.cookie);

let state: MeState = { loaded: false, user: null };
let inflight: Promise<void> | null = null;
const listeners = new Set<(s: MeState) => void>();
const emit = (s: MeState) => {
  state = s;
  for (const l of listeners) l(s);
};

export function refreshMe(): Promise<void> {
  if (!hasHint()) {
    emit({ loaded: true, user: null });
    return Promise.resolve();
  }
  inflight = api<{ user: Me | null }>("/api/community/me").then((r) => {
    emit({ loaded: true, user: r.ok ? r.user : null });
    inflight = null;
  });
  return inflight;
}

/** The signed-in member ({loaded, user}); loads once per page. */
export function useMe(): MeState & { refresh: () => Promise<void> } {
  const [s, set] = useState<MeState>(state);
  useEffect(() => {
    listeners.add(set);
    if (!state.loaded && !inflight) void refreshMe();
    else set(state);
    return () => {
      listeners.delete(set);
    };
  }, []);
  return { ...s, refresh: refreshMe };
}

export async function signOut(): Promise<void> {
  await api("/api/community/auth/signout", { method: "POST", body: {} });
  emit({ loaded: true, user: null });
}

/** Your own votes on a list of targets (empty when signed out). */
export async function myVotes(kind: string, ids: string[]): Promise<Record<string, -1 | 1>> {
  if (!ids.length || !hasHint()) return {};
  const r = await api<{ votes: Record<string, -1 | 1> }>(`/api/community/votes/mine?kind=${kind}&ids=${ids.map(encodeURIComponent).join(",")}`);
  return r.ok ? r.votes : {};
}

/** Calls `onVisible` once the element is near the viewport (or at once without IntersectionObserver). */
export function useNearViewport(ref: React.RefObject<Element>, margin = "600px"): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen || !ref.current) return;
    if (typeof IntersectionObserver === "undefined") return setSeen(true);
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setSeen(true), { rootMargin: margin });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [ref, margin, seen]);
  return seen;
}

export const inputClass = "w-full rounded border border-line bg-surface px-2 py-1.5 text-sm text-fg placeholder:text-subtle focus:border-accent focus:outline-none";
export const linkButton = "text-xs text-muted hover:text-fg hover:underline";
