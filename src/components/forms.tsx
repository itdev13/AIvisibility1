"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { login, signup, changePassword, type FormState } from "@/app/actions/auth";
import { startCheck, unlockReport } from "@/app/actions/check";
import { requestCallback } from "@/app/actions/contact";
import { completeOnboarding, scanSite } from "@/app/actions/onboarding";
import { saveCompetitors, saveWordPress, updateProfile } from "@/app/actions/workspace";
import { createClient } from "@/app/actions/admin";
import { Button, Field, Input, Notice, Select, Textarea } from "./ui";
import { cn } from "@/lib/utils";
import { PLAN_LIST } from "@/lib/plans";

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("h-4 w-4 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function SubmitButton({ children, pendingText, ...p }: React.ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || p.disabled} {...p}>
      {pending && <Spinner />}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}

const Msg = ({ state }: { state: FormState }) =>
  state?.error ? <Notice tone="bad">{state.error}</Notice> : state?.ok && state.ok !== "unlocked" ? <Notice tone="good">{state.ok}</Notice> : null;

/* ───────── Auth ───────── */
export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required autoFocus />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Msg state={state} />
      <SubmitButton className="w-full" size="lg" pendingText="Signing in…">Sign in</SubmitButton>
    </form>
  );
}

export function SignupForm({ plan }: { plan?: string }) {
  const [state, action] = useActionState(signup, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="plan" value={plan ?? ""} />
      <Field label="Your name">
        <Input name="name" autoComplete="name" required autoFocus />
      </Field>
      <Field label="Work email">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Msg state={state} />
      <SubmitButton className="w-full" size="lg" pendingText="Creating account…">Create account</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Current password">
        <Input name="current" type="password" required />
      </Field>
      <Field label="New password">
        <Input name="next" type="password" minLength={8} required />
      </Field>
      <div className="sm:col-span-2 flex items-center gap-3">
        <SubmitButton variant="outline">Update password</SubmitButton>
        <Msg state={state} />
      </div>
    </form>
  );
}

/* ───────── Free check ───────── */
export function CheckForm({ size = "lg", dark = false, autoFocus = false }: { size?: "md" | "lg"; dark?: boolean; autoFocus?: boolean }) {
  const [state, action] = useActionState(startCheck, undefined);
  return (
    <form action={action} className="w-full">
      <div
        className={cn(
          "flex flex-col gap-1.5 rounded-[6px] border p-1.5 transition sm:flex-row sm:items-center sm:gap-2",
          dark ? "border-white/30 bg-white/[0.06] focus-within:border-lime" : "border-ink-950 bg-white shadow-[4px_4px_0_0_#12100D] focus-within:shadow-[4px_4px_0_0_#E4FF3C]",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className={cn("pl-3", dark ? "text-white/40" : "text-ink-400")}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6.25" /><path d="M1.75 8h12.5M8 1.75c1.8 1.9 2.6 4 2.6 6.25S9.8 12.35 8 14.25M8 1.75C6.2 3.65 5.4 5.75 5.4 8S6.2 12.35 8 14.25" /></svg>
          </span>
          <input
            name="url"
            required
            autoFocus={autoFocus}
            placeholder="yourwebsite.com"
            aria-label="Your website"
            className={cn("h-11 min-w-0 flex-1 bg-transparent text-[16px] focus:outline-none sm:text-[15px]", dark ? "text-white placeholder:text-white/35" : "text-ink-950 placeholder:text-ink-400")}
          />
        </div>
        <SubmitButton variant="lime" size={size} pendingText="Starting…" className="w-full shrink-0 sm:w-auto">
          Check my AI visibility
        </SubmitButton>
      </div>
      {state?.error && <p className={cn("mt-2 text-[13px]", dark ? "text-[#ffb4ab]" : "text-bad")}>{state.error}</p>}
    </form>
  );
}

export function UnlockForm({ checkId }: { checkId: string }) {
  const [state, action] = useActionState(unlockReport, undefined);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok === "unlocked") router.refresh();
  }, [state, router]);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="checkId" value={checkId} />
      <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
        <Input name="name" placeholder="First name" autoComplete="given-name" />
        <Input name="email" type="email" placeholder="Work email" required autoComplete="email" />
        <SubmitButton variant="primary" pendingText="Unlocking…">Unlock full report</SubmitButton>
      </div>
      {state?.error && <p className="text-[13px] text-bad">{state.error}</p>}
      <p className="text-[12px] text-ink-500">We'll email you a copy. No spam, unsubscribe any time.</p>
    </form>
  );
}

/** Polls check status and refreshes the page when the report is ready. */
export function ReportProgress({ id, initial }: { id: string; initial: { step: string; progress: number } }) {
  const router = useRouter();
  const [s, setS] = useState({ ...initial, status: "running", error: "" });
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch(`/api/check/${id}`, { cache: "no-store" });
        const j = await r.json();
        if (!alive) return;
        setS(j);
        if (j.status === "done" || j.status === "failed") return router.refresh();
      } catch {
        /* keep polling */
      }
      if (alive) setTimeout(tick, 1500);
    };
    const t = setTimeout(tick, 1200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [id, router]);
  const steps = ["Reading your website", "Working out what you do", "Writing the questions your buyers ask AI", "Asking AI engines", "Checking your site's AI readiness"];
  const activeIdx = Math.max(0, steps.findIndex((x) => s.step.startsWith(x.split(" (")[0].slice(0, 14))));
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[13px]">
        <span className="font-medium text-ink-800">{s.step}</span>
        <span className="tnum text-ink-500">{s.progress}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-150">
        <div className="h-full rounded-full bg-ink-900 transition-all duration-700" style={{ width: `${Math.max(4, s.progress)}%` }} />
      </div>
      <ol className="mt-6 space-y-2.5">
        {steps.map((st, i) => (
          <li key={st} className={cn("flex items-center gap-3 text-[14px]", i < activeIdx ? "text-ink-500" : i === activeIdx ? "font-medium text-ink-950" : "text-ink-400")}>
            <span className={cn("grid h-5 w-5 place-items-center rounded-full border text-[10px]", i < activeIdx ? "border-good bg-good text-white" : i === activeIdx ? "border-ink-900" : "border-ink-200")}>
              {i < activeIdx ? "✓" : i === activeIdx ? <span className="h-1.5 w-1.5 rounded-full bg-ink-900 animate-pulse-dot" /> : ""}
            </span>
            {st}
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ───────── Onboarding ───────── */
export function OnboardingForm({ defaults }: { defaults: { website: string; name: string; category: string; description: string; location: string; audience: string; competitors: string; aliases: string; maxCompetitors: number } }) {
  const [state, action] = useActionState(completeOnboarding, undefined);
  const [v, setV] = useState(defaults);
  const [scanning, startScan] = useTransition();
  const [scanMsg, setScanMsg] = useState("");
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  const scan = () =>
    startScan(async () => {
      setScanMsg("");
      const r = await scanSite(v.website);
      if (r.error || !r.profile) return setScanMsg(r.error ?? "Scan failed");
      const p = r.profile;
      setV((cur) => ({
        ...cur,
        name: cur.name || p.brand,
        category: p.category || cur.category,
        description: p.description || cur.description,
        location: p.location || cur.location,
        audience: p.audience || cur.audience,
        competitors: cur.competitors || p.competitors.slice(0, defaults.maxCompetitors).map((c) => (c.domain ? `${c.name}, ${c.domain}` : c.name)).join("\n"),
      }));
      setScanMsg("Filled in from your site. Check everything looks right.");
    });

  return (
    <form action={action} className="space-y-5">
      <Field label="Website">
        <div className="flex gap-2">
          <Input name="website" value={v.website} onChange={set("website")} placeholder="https://yourcompany.com" required />
          <Button type="button" variant="outline" onClick={scan} disabled={!v.website || scanning} className="shrink-0">
            {scanning ? <Spinner /> : <span aria-hidden>✦</span>}
            {scanning ? "Reading site…" : "Auto-fill from site"}
          </Button>
        </div>
        {scanMsg && <p className="mt-1.5 text-[12.5px] text-ink-600">{scanMsg}</p>}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Brand name" hint="The name customers use.">
          <Input name="name" value={v.name} onChange={set("name")} required />
        </Field>
        <Field label="What you sell" hint="As a buyer would search it, e.g. “family dental clinic”.">
          <Input name="category" value={v.category} onChange={set("category")} required />
        </Field>
      </div>
      <Field label="One-line description">
        <Input name="description" value={v.description} onChange={set("description")} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Who buys from you">
          <Input name="audience" value={v.audience} onChange={set("audience")} placeholder="e.g. HR leaders at 50–500 person companies" />
        </Field>
        <Field label="Location served" hint="Leave blank if you're not local.">
          <Input name="location" value={v.location} onChange={set("location")} placeholder="e.g. Austin, TX" />
        </Field>
      </div>
      <Field label={`Competitors (up to ${defaults.maxCompetitors})`} hint="One per line: Name, domain.com">
        <Textarea name="competitors" rows={4} value={v.competitors} onChange={set("competitors")} placeholder={"Acme Dental, acmedental.com\nBright Smiles, brightsmiles.com"} />
      </Field>
      <Field label="Other names AI might use for you" hint="Comma-separated: old names, abbreviations, product names.">
        <Input name="aliases" value={v.aliases} onChange={set("aliases")} />
      </Field>
      <Msg state={state} />
      <SubmitButton size="lg" className="w-full" pendingText="Setting up your workspace…">
        Launch my dashboard
      </SubmitButton>
    </form>
  );
}

/* ───────── Workspace settings ───────── */
export function CompetitorsForm({ competitors, aliases, max }: { competitors: string; aliases: string; max: number }) {
  const [state, action] = useActionState(saveCompetitors, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label={`Competitors (up to ${max})`} hint="One per line: Name, domain.com">
        <Textarea name="competitors" rows={Math.max(4, max)} defaultValue={competitors} />
      </Field>
      <Field label="Other names for your brand" hint="Comma-separated. Helps us catch every mention.">
        <Input name="aliases" defaultValue={aliases} />
      </Field>
      <div className="flex items-center gap-3">
        <SubmitButton>Save</SubmitButton>
        <Msg state={state} />
      </div>
    </form>
  );
}

export function WordPressForm({ url, username, connected }: { url: string; username: string; connected: boolean }) {
  const [state, action] = useActionState(saveWordPress, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Site URL">
          <Input name="url" defaultValue={url} placeholder="https://yoursite.com" />
        </Field>
        <Field label="Username">
          <Input name="username" defaultValue={username} />
        </Field>
        <Field label="Application password" hint="Users → Profile → Application Passwords">
          <Input name="appPassword" type="password" placeholder={connected ? "•••••••• (saved)" : ""} />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton variant="outline" pendingText="Verifying…">{connected ? "Update" : "Connect WordPress"}</SubmitButton>
        <Msg state={state} />
      </div>
    </form>
  );
}

/* ───────── Ops: new client ───────── */
export function CreateClientForm() {
  const [state, action] = useActionState(createClient, undefined);
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Brand name"><Input name="name" required /></Field>
        <Field label="Website"><Input name="website" required placeholder="https://" /></Field>
        <Field label="What they sell"><Input name="category" required /></Field>
        <Field label="Plan">
          <Select name="plan" defaultValue="growth">
            {PLAN_LIST.map((p) => <option key={p.id} value={p.id}>{p.name} — ${p.price}/mo</option>)}
          </Select>
        </Field>
        <Field label="Location served"><Input name="location" /></Field>
        <Field label="Audience"><Input name="audience" /></Field>
      </div>
      <Field label="Description"><Input name="description" /></Field>
      <Field label="Competitors" hint="One per line: Name, domain.com"><Textarea name="competitors" rows={4} /></Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Client contact name"><Input name="contactName" /></Field>
        <Field label="Client contact email" hint="We'll email them a login. Leave blank to invite later."><Input name="contactEmail" type="email" /></Field>
      </div>
      <Field label="Internal notes"><Textarea name="notes" rows={3} placeholder="Deal context, promises made on the call…" /></Field>
      <Msg state={state} />
      <SubmitButton size="lg" pendingText="Creating…">Create client & start setup</SubmitButton>
    </form>
  );
}

/* ───────── Settings: business profile ───────── */
type Profile = { name: string; website: string; category: string; description: string; audience: string; location: string };

export function ProfileForm({ initial }: { initial: Profile }) {
  const [state, action] = useActionState(updateProfile, undefined);
  const [v, setV] = useState(initial);
  const [scanning, startScan] = useTransition();
  const [scanMsg, setScanMsg] = useState("");
  const set = (k: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  const dirty = (Object.keys(initial) as (keyof Profile)[]).some((k) => initial[k] !== v[k]);

  const scan = () =>
    startScan(async () => {
      setScanMsg("");
      const r = await scanSite(v.website);
      if (r.error || !r.profile) return setScanMsg(r.error ?? "We couldn't read that site.");
      const p = r.profile;
      // Only fill what's empty — never overwrite something the client typed.
      setV((cur) => ({
        ...cur,
        category: cur.category || p.category,
        description: cur.description || p.description,
        audience: cur.audience || p.audience,
        location: cur.location || p.location,
      }));
      setScanMsg("Filled the empty fields from your website. Review, then save.");
    });

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Brand name" hint="Exactly as customers say it.">
          <Input name="name" value={v.name} onChange={set("name")} required />
        </Field>
        <Field label="Website">
          <Input name="website" value={v.website} onChange={set("website")} required />
        </Field>
      </div>
      <Field label="What you sell" hint="As a buyer would search for it, e.g. “accounting software for small agencies”.">
        <Input name="category" value={v.category} onChange={set("category")} required />
      </Field>
      <Field label="One-line description">
        <Textarea name="description" rows={2} value={v.description} onChange={set("description")} placeholder="What you do and who it's for." />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Who buys from you">
          <Input name="audience" value={v.audience} onChange={set("audience")} placeholder="e.g. Owners of 5–50 person agencies" />
        </Field>
        <Field label="Location served" hint="Leave blank if you sell everywhere.">
          <Input name="location" value={v.location} onChange={set("location")} placeholder="e.g. Hyderabad, India" />
        </Field>
      </div>
      {scanMsg && <Notice tone="info">{scanMsg}</Notice>}
      <Msg state={state} />
      <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 pt-5">
        <SubmitButton disabled={!dirty} pendingText="Saving…">Save profile</SubmitButton>
        <Button type="button" variant="ghost" onClick={scan} disabled={!v.website || scanning}>
          {scanning ? <Spinner /> : <span aria-hidden>✦</span>}
          {scanning ? "Reading your site…" : "Fill gaps from website"}
        </Button>
        {dirty && <span className="text-[12.5px] text-ink-500">Unsaved changes</span>}
      </div>
    </form>
  );
}

/* ───────── Public: "Talk to us" ───────── */
export function ContactForm() {
  const [state, action] = useActionState(requestCallback, undefined);
  if (state?.ok === "sent")
    return (
      <div className="border border-ink-950 bg-lime p-6">
        <div className="display text-[28px] text-ink-950">Thanks, we've got it.</div>
        <p className="mt-2 text-[15px] text-ink-800">We'll look at how AI sees your business and get back to you by email soon. In the meantime you can run the free check above.</p>
      </div>
    );
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {/* Hidden from people; bots fill it in. */}
      <input type="text" name="company_site" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <Field label="Your name">
        <Input id="contact-name" name="name" autoComplete="name" required />
      </Field>
      <Field label="Email">
        <Input id="contact-email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Your business" hint="e.g. Dental clinic in Pune, plumbing company in Austin">
        <Input id="contact-business" name="business" />
      </Field>
      <Field label="Website">
        <Input id="contact-website" name="website" placeholder="yourbusiness.com" />
      </Field>
      <Field label="Anything we should know? (optional)" className="sm:col-span-2">
        <Textarea id="contact-message" name="message" rows={3} placeholder="What you sell, where your customers are, what you've tried…" />
      </Field>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <SubmitButton size="lg" pendingText="Sending…">Get in touch</SubmitButton>
        <span className="text-[13px] text-ink-500">No obligation. We reply by email.</span>
      </div>
      {state?.error && <p className="text-[13px] text-bad sm:col-span-2">{state.error}</p>}
    </form>
  );
}
