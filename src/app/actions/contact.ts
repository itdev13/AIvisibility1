"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { Lead } from "@/lib/models";
import { domainOf } from "@/lib/utils";
import type { FormState } from "./auth";

const Contact = z.object({
  name: z.string().trim().min(1, "Tell us your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter an email we can reply to"),
  website: z.string().trim().max(200).optional(),
  business: z.string().trim().max(120).optional(),
  message: z.string().trim().max(2000).optional(),
});

/** "Talk to us" form: lands in the Ops desk Leads tab for James to call back. */
export async function requestCallback(_: FormState, fd: FormData): Promise<FormState> {
  if (String(fd.get("company_site") ?? "")) return { ok: "sent" }; // honeypot: bots fill hidden fields
  const p = Contact.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const { name, email, website, business, message } = p.data;
  await db();
  const notes = [business && `Business: ${business}`, message && `Message: ${message}`].filter(Boolean).join("\n");
  await Lead.updateOne(
    { email, domain: website ? domainOf(website) : "" },
    { $set: { name, ...(notes ? { notes } : {}) }, $setOnInsert: { source: "contact", status: "new" } },
    { upsert: true },
  );
  return { ok: "sent" };
}
