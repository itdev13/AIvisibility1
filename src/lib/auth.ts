import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { env } from "./env";
import { Client, User, type ClientDoc, type UserDoc } from "./models";
import { SESSION_COOKIE, VIEW_AS_COOKIE, signSession, verifySession } from "./session";

export const hashPassword = (p: string) => bcrypt.hash(p, 11);
export const checkPassword = (p: string, h: string) => bcrypt.compare(p, h);

export const isAdminEmail = (email: string) => env.adminEmails().includes(email.toLowerCase());

export async function startSession(user: { _id: unknown; role: "client" | "admin" }) {
  const token = await signSession({ uid: String(user._id), role: user.role });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function endSession() {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
  c.delete(VIEW_AS_COOKIE);
}

export async function currentUser(): Promise<UserDoc | null> {
  const s = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!s) return null;
  await db();
  return User.findById(s.uid).lean<UserDoc>();
}

export async function requireUser(): Promise<UserDoc> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdmin(): Promise<UserDoc> {
  const u = await requireUser();
  if (u.role !== "admin") redirect("/app");
  return u;
}

/**
 * The workspace the current viewer is looking at. Admins may "view as" any client
 * (cookie set from the Ops console); clients always see their own.
 */
export async function requireClient(): Promise<{ user: UserDoc; client: ClientDoc; viewingAs: boolean }> {
  const user = await requireUser();
  await db();
  if (user.role === "admin") {
    const viewId = (await cookies()).get(VIEW_AS_COOKIE)?.value;
    const client = viewId ? await Client.findById(viewId).lean<ClientDoc>() : null;
    if (!client) redirect("/admin");
    return { user, client, viewingAs: true };
  }
  if (!user.clientId) redirect("/onboarding");
  const client = await Client.findById(user.clientId).lean<ClientDoc>();
  if (!client) redirect("/onboarding");
  if (client.status === "onboarding" && !client.onboardedAt) redirect("/onboarding");
  return { user, client, viewingAs: false };
}
