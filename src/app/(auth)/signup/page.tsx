import Link from "next/link";
import type { Metadata } from "next";
import { SignupForm } from "@/components/forms";
import { GoogleButton, OrDivider } from "@/components/ui";
import { getPlan } from "@/lib/plans";
import { googleAvailable } from "@/lib/services/google";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  const p = getPlan(plan);
  return (
    <>
      <h1 className="display text-[40px] text-ink-950">Create your account</h1>
      <p className="mb-8 mt-1.5 text-[14px] text-ink-500">
        {p ? (
          <>
            You're starting on <b className="text-ink-900">{p.name}</b> at ${p.price.toLocaleString()}/month. You can change plans any time.
          </>
        ) : (
          "Takes a minute. Your dashboard is live within the hour."
        )}
      </p>
      {googleAvailable() && (
        <>
          <GoogleButton href={`/api/auth/google${p ? `?plan=${p.id}` : ""}`} label="Sign up with Google" />
          <OrDivider />
        </>
      )}
      <SignupForm plan={p?.id} />
      <p className="mt-6 text-center text-[13.5px] text-ink-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-ink-950 underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </>
  );
}
