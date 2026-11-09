"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { checkPassword, endSession, hashPassword, isAdminEmail, requireUser, startSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { User } from "@/lib/models";

export type FormState = { error?: string; ok?: string } | undefined;

const safeNext = (n: unknown) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : "");

const SignupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

export async function signup(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = SignupSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password } = parsed.data;
  await db();
  if (await User.exists({ email })) return { error: "An account with that email already exists. Sign in instead." };
  const role = isAdminEmail(email) ? "admin" : "client";
  const user = await User.create({ name, email, passwordHash: await hashPassword(password), role });
  await startSession(user);
  if (role === "admin") redirect("/admin");
  const plan = String(fd.get("plan") ?? "");
  redirect(`/onboarding${plan ? `?plan=${encodeURIComponent(plan)}` : ""}`);
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  await db();
  const user = await User.findOne({ email });
  if (!user || !(await checkPassword(password, user.passwordHash))) return { error: "That email and password don't match." };
  // Promote/demote based on the admin allow-list on every login.
  const role = isAdminEmail(email) ? "admin" : "client";
  if (user.role !== role) user.role = role;
  user.lastLoginAt = new Date();
  await user.save();
  await startSession(user);
  redirect(safeNext(fd.get("next")) || (role === "admin" ? "/admin" : "/app"));
}

export async function logout() {
  await endSession();
  redirect("/");
}

export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  const user = await User.findById(u._id);
  if (!user || !(await checkPassword(current, user.passwordHash))) return { error: "Current password is incorrect." };
  user.passwordHash = await hashPassword(next);
  await user.save();
  return { ok: "Password updated." };
}
