import { env } from "../env";

/** Transactional email via Resend; logs to console when no key is set (dev). */
export async function sendEmail(to: string, subject: string, html: string) {
  if (!env.resendKey()) {
    console.log(`[email:dev] to=${to} subject="${subject}"`);
    return { ok: true, dev: true };
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.resendKey()}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.emailFrom(), to, subject, html }),
  });
  if (!r.ok) console.error("[email] send failed", r.status, await r.text());
  return { ok: r.ok };
}

const shell = (body: string) => `<!doctype html><html><body style="margin:0;background:#F9F9F7;font-family:-apple-system,Segoe UI,Inter,sans-serif;color:#12151A">
<div style="max-width:560px;margin:0 auto;padding:40px 24px">
<div style="font-weight:700;font-size:18px;letter-spacing:-0.02em;margin-bottom:28px">Mentiq<span style="color:#5B7300">.</span></div>
${body}
<p style="margin-top:40px;color:#8E949D;font-size:12px">Mentiq AI — get mentioned when buyers ask AI.</p>
</div></body></html>`;

const btn = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#12151A;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;font-size:14px">${label}</a>`;

export const emails = {
  report: (domain: string, score: number, url: string) =>
    shell(`<h1 style="font-size:24px;letter-spacing:-0.02em;margin:0 0 12px">Your AI visibility report for ${domain}</h1>
<p style="font-size:15px;line-height:1.6;color:#353A43">You scored <b>${score}/100</b>. The full report shows which questions AI answers without you, who it recommends instead, and the fixes that would change that.</p>
<p style="margin:28px 0">${btn(url, "Open your report")}</p>`),
  welcome: (name: string, url: string) =>
    shell(`<h1 style="font-size:24px;letter-spacing:-0.02em;margin:0 0 12px">Welcome to Mentiq, ${name}</h1>
<p style="font-size:15px;line-height:1.6;color:#353A43">We're setting up your workspace now: buyer questions, your first AI visibility check, and a full site audit. Your 90-day roadmap follows within 24 hours.</p>
<p style="margin:28px 0">${btn(url, "Open your dashboard")}</p>`),
  invite: (name: string, url: string, tempPassword: string) =>
    shell(`<h1 style="font-size:24px;letter-spacing:-0.02em;margin:0 0 12px">Your Mentiq dashboard is ready</h1>
<p style="font-size:15px;line-height:1.6;color:#353A43">Hi ${name}, your team has set up your AI visibility dashboard. Sign in with this email and the temporary password <code style="background:#ECEDEF;padding:2px 6px;border-radius:6px">${tempPassword}</code>, then change it in Settings.</p>
<p style="margin:28px 0">${btn(url, "Sign in")}</p>`),
  review: (title: string, url: string) =>
    shell(`<h1 style="font-size:22px;letter-spacing:-0.02em;margin:0 0 12px">New content ready for your approval</h1>
<p style="font-size:15px;line-height:1.6;color:#353A43">“${title}” has been written and checked by our editors. Approve it or leave a note and we'll revise.</p>
<p style="margin:28px 0">${btn(url, "Review it")}</p>`),
};
