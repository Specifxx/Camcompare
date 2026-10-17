import type { Metadata } from "next";
import SignInLanding from "@/components/community/SignInLanding";

// Where the emailed sign-in link lands. no-referrer: the token is in the
// address until the page removes it, and it must never leave in a Referer.
export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function SignInPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold">Sign in to the community</h1>
      <p className="mt-1 text-sm text-muted">One account for comments, reviews, votes and the boards. No password: we email you a link that works once, for 15 minutes.</p>
      <div className="mt-4">
        <SignInLanding />
      </div>
      <p className="mt-6 text-xs text-subtle">
        We keep your email to sign you in and never show it to anyone. <a href="/privacy">Privacy</a>
      </p>
    </div>
  );
}
