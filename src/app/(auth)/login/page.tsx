import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "@/components/forms";
import { GoogleButton, Notice, OrDivider } from "@/components/ui";
import { googleAvailable } from "@/lib/services/google";
import { SHOW_LOGIN } from "@/lib/seo";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  google_denied: "Google sign-in was cancelled.",
  google_state: "That sign-in link expired. Please try again.",
  google_error: "Something went wrong signing in with Google. Please try again.",
  google_unverified: "Your Google email isn't verified, so we can't use it to sign in.",
  google_mismatch: "This email is linked to a different Google account.",
  google_unavailable: "Google sign-in isn't set up yet.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <>
      <h1 className="display text-[40px] text-ink-950">Welcome back</h1>
      <p className="mb-8 mt-1.5 text-[14px] text-ink-500">Sign in to your BayClusterLab dashboard.</p>
      {error && ERRORS[error] && <Notice tone="bad" className="mb-5">{ERRORS[error]}</Notice>}
      {googleAvailable() && (
        <>
          <GoogleButton href={`/api/auth/google${next ? `?next=${encodeURIComponent(next)}` : ""}`} />
          <OrDivider />
        </>
      )}
      <LoginForm next={next} />
      {SHOW_LOGIN && (
        <p className="mt-6 text-center text-[13.5px] text-ink-500">
          New to BayClusterLab?{" "}
          <Link href="/signup" className="font-medium text-ink-950 underline underline-offset-2">
            Create an account
          </Link>
        </p>
      )}
    </>
  );
}
