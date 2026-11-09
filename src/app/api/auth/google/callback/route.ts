import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hashPassword, isAdminEmail, startSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { Client, User } from "@/lib/models";
import { getPlan } from "@/lib/plans";
import { exchangeCode, loginRedirectUri, readIdToken } from "@/lib/services/google";

export const dynamic = "force-dynamic";

const safeNext = (n: string) => (n.startsWith("/") && !n.startsWith("//") ? n : "");

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fail = (code: string) => NextResponse.redirect(`${env.appUrl()}/login?error=${code}`);
  const jar = await cookies();
  const raw = jar.get("mq_glogin")?.value;
  jar.delete("mq_glogin");
  let carry: { state: string; next: string; plan: string };
  try {
    carry = JSON.parse(Buffer.from(raw ?? "", "base64url").toString());
  } catch {
    return fail("google_state");
  }
  if (!carry.state || carry.state !== url.searchParams.get("state")) return fail("google_state");
  const code = url.searchParams.get("code");
  if (!code) return fail("google_denied");

  let id: ReturnType<typeof readIdToken>;
  try {
    const t = await exchangeCode(code, loginRedirectUri());
    if (!t.id_token) return fail("google_error");
    id = readIdToken(t.id_token);
  } catch {
    return fail("google_error");
  }
  if (!id.email || !id.verified) return fail("google_unverified");

  await db();
  const role = isAdminEmail(id.email) ? "admin" : "client";
  let user = await User.findOne({ email: id.email });
  if (!user) {
    // Random password: Google users sign in with Google; admins can still reset them.
    user = await User.create({ email: id.email, name: id.name, googleId: id.sub, role, passwordHash: await hashPassword(randomBytes(24).toString("hex")) });
  } else {
    if (user.googleId && user.googleId !== id.sub) return fail("google_mismatch");
    user.googleId = id.sub;
    if (!user.name && id.name) user.name = id.name;
    user.role = role;
  }
  user.lastLoginAt = new Date();
  await user.save();
  await startSession(user);

  if (role === "admin") return NextResponse.redirect(`${env.appUrl()}${safeNext(carry.next) || "/admin"}`);
  const client = user.clientId ? await Client.findById(user.clientId).select("onboardedAt").lean() : null;
  if (!client?.onboardedAt) {
    const plan = getPlan(carry.plan);
    return NextResponse.redirect(`${env.appUrl()}/onboarding${plan ? `?plan=${plan.id}` : ""}`);
  }
  return NextResponse.redirect(`${env.appUrl()}${safeNext(carry.next) || "/app"}`);
}
