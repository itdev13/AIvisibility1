import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { googleAvailable, googleLoginUrl } from "@/lib/services/google";

export const dynamic = "force-dynamic";

/** Start "Continue with Google". Carries ?next= and ?plan= through the round trip. */
export async function GET(req: Request) {
  if (!googleAvailable()) return NextResponse.redirect(`${env.appUrl()}/login?error=google_unavailable`);
  const url = new URL(req.url);
  const state = randomUUID();
  const carry = JSON.stringify({ state, next: url.searchParams.get("next") ?? "", plan: url.searchParams.get("plan") ?? "" });
  (await cookies()).set("mq_glogin", Buffer.from(carry).toString("base64url"), { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/", secure: process.env.NODE_ENV === "production" });
  return NextResponse.redirect(googleLoginUrl(state));
}
