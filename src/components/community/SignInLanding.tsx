"use client";
// /community/signin: where the emailed link lands. The token arrives in the
// query string and is POSTed (a mail scanner's GET can't spend it), then
// removed from the address bar. Without a token: the email form, and the
// signed-in member's username picker or sign-out.
import { useEffect, useRef, useState } from "react";
import { SignInBox, UsernamePicker } from "./bits";
import { api, refreshMe, signOut, useMe } from "./client";

const safeNext = (p: string | null) => (p && p.startsWith("/") && !p.startsWith("//") && !p.startsWith("/\\") ? p : "/community");

export default function SignInLanding() {
  const { user, loaded } = useMe();
  const [phase, setPhase] = useState<"idle" | "token" | "verifying" | "username" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [next, setNext] = useState("/community");
  const token = useRef<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    setNext(safeNext(q.get("next")));
    const t = q.get("token");
    if (t) {
      token.current = t;
      history.replaceState(null, "", "/community/signin");
      setPhase("token");
    }
  }, []);

  const verify = async () => {
    if (!token.current) return;
    setPhase("verifying");
    const r = await api<{ needsUsername: boolean; next: string | null }>("/api/community/auth/verify", { method: "POST", body: { token: token.current } });
    token.current = null;
    if (!r.ok) {
      setError(r.error);
      return setPhase("error");
    }
    const dest = safeNext(r.next);
    setNext(dest);
    await refreshMe();
    if (r.needsUsername) return setPhase("username");
    setPhase("done");
    location.href = dest;
  };

  if (phase === "token" || phase === "verifying")
    return (
      <div className="space-y-3">
        <p className="text-sm">One more click to sign in on this browser.</p>
        <button type="button" onClick={verify} disabled={phase === "verifying"} className="btn-primary px-4 py-1.5 text-sm disabled:opacity-60">
          {phase === "verifying" ? "Signing in…" : "Sign in"}
        </button>
      </div>
    );
  if (phase === "username")
    return (
      <UsernamePicker
        onDone={() => {
          location.href = next;
        }}
      />
    );
  if (phase === "done") return <p className="text-sm">Signed in. Taking you back…</p>;
  if (!loaded) return null;
  return (
    <div className="space-y-4">
      {phase === "error" && <p role="alert" className="text-sm text-warn">{error}</p>}
      {user ? (
        user.username ? (
          <p className="text-sm">
            You&apos;re signed in as <a href={`/u/${user.username}`} className="font-semibold">{user.username}</a>.{" "}
            <button type="button" className="text-accent underline" onClick={() => void signOut()}>
              Sign out
            </button>
          </p>
        ) : (
          <UsernamePicker onDone={() => (location.href = next)} />
        )
      ) : (
        <SignInBox prompt="Enter your email to sign in or join." next={next} />
      )}
    </div>
  );
}
