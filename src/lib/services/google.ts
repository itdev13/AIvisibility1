import { db } from "../db";
import { env } from "../env";
import { Client, Traffic, logActivity, type ClientDoc } from "../models";
import { daysAgo } from "../utils";

/** Search Console + GA4 via OAuth (read-only scopes). */
const SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly", "https://www.googleapis.com/auth/analytics.readonly", "openid", "email"];

export const googleAvailable = () => Boolean(env.googleClientId() && env.googleClientSecret());
const redirectUri = () => `${env.appUrl()}/api/google/callback`;

export function googleAuthUrl(state: string) {
  const p = new URLSearchParams({
    client_id: env.googleClientId(),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.googleClientId(), client_secret: env.googleClientSecret(), ...body }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error_description ?? j.error ?? "Google token error");
  return j as { access_token: string; refresh_token?: string; id_token?: string };
}

export const exchangeCode = (code: string, redirect = redirectUri()) => tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirect });

/* ───────── Sign in with Google (identity only: openid email profile) ───────── */
export const loginRedirectUri = () => `${env.appUrl()}/api/auth/google/callback`;

export function googleLoginUrl(state: string) {
  const p = new URLSearchParams({
    client_id: env.googleClientId(),
    redirect_uri: loginRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

/**
 * The ID token comes straight from Google's token endpoint over TLS, so its claims can be
 * read without verifying the signature (OpenID Connect Core §3.1.3.7). We still check audience and issuer.
 */
export function readIdToken(idToken: string) {
  const c = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString());
  if (c.aud !== env.googleClientId()) throw new Error("Token audience mismatch");
  if (!["accounts.google.com", "https://accounts.google.com"].includes(c.iss)) throw new Error("Token issuer mismatch");
  return { sub: String(c.sub), email: String(c.email ?? "").toLowerCase(), verified: c.email_verified === true || c.email_verified === "true", name: String(c.name ?? "") };
}
const accessToken = async (refresh: string) => (await tokenRequest({ refresh_token: refresh, grant_type: "refresh_token" })).access_token;

async function gget(url: string, token: string) {
  const r = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Google API ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
async function gpost(url: string, token: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Google API ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

/** Lists the Search Console sites and GA4 properties the connected account can see. */
export async function listGoogleAssets(refresh: string) {
  const t = await accessToken(refresh);
  const [sites, summaries] = await Promise.all([
    gget("https://www.googleapis.com/webmasters/v3/sites", t).catch(() => ({ siteEntry: [] })),
    gget("https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200", t).catch(() => ({ accountSummaries: [] })),
  ]);
  return {
    sites: (sites.siteEntry ?? []).map((s: any) => s.siteUrl as string),
    properties: (summaries.accountSummaries ?? []).flatMap((a: any) =>
      (a.propertySummaries ?? []).map((p: any) => ({ id: String(p.property).replace("properties/", ""), name: `${a.displayName} — ${p.displayName}` })),
    ) as { id: string; name: string }[],
  };
}

/** Referrers we count as AI assistants in GA4. */
export const AI_SOURCE_RE = "chatgpt|openai|perplexity|gemini|bard|copilot|claude|anthropic|you\\.com|phind|grok|meta\\.ai|deepseek|mistral";

/** Pull the last N days of Search Console + GA4 into the Traffic collection. */
export async function syncTraffic(clientId: string, days = 35) {
  await db();
  const client = await Client.findById(clientId).lean<ClientDoc>();
  const g = client?.integrations?.google;
  if (!g?.refreshToken) return { synced: 0 };
  const t = await accessToken(g.refreshToken);
  const start = daysAgo(days);
  const end = daysAgo(1);
  const rows = new Map<string, Record<string, any>>();
  const row = (d: string) => rows.get(d) ?? rows.set(d, { aiBySource: {} }).get(d)!;

  if (g.gscSite) {
    const r = await gpost(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(g.gscSite)}/searchAnalytics/query`, t, {
      startDate: start,
      endDate: end,
      dimensions: ["date"],
      rowLimit: 500,
    });
    for (const x of r.rows ?? []) Object.assign(row(x.keys[0]), { clicks: x.clicks, impressions: x.impressions, position: x.position });
  }

  if (g.ga4Property) {
    const report = await gpost(`https://analyticsdata.googleapis.com/v1beta/properties/${g.ga4Property}:runReport`, t, {
      dateRanges: [{ startDate: start, endDate: end }],
      dimensions: [{ name: "date" }, { name: "sessionSource" }],
      metrics: [{ name: "sessions" }, { name: "keyEvents" }],
      limit: 10000,
    });
    const re = new RegExp(AI_SOURCE_RE, "i");
    for (const x of report.rows ?? []) {
      const raw = x.dimensionValues[0].value as string;
      const d = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
      const src = x.dimensionValues[1].value as string;
      const sessions = Number(x.metricValues[0].value) || 0;
      const conv = Number(x.metricValues[1].value) || 0;
      const r = row(d);
      r.sessions = (r.sessions ?? 0) + sessions;
      r.conversions = (r.conversions ?? 0) + conv;
      if (re.test(src)) {
        r.aiSessions = (r.aiSessions ?? 0) + sessions;
        r.aiConversions = (r.aiConversions ?? 0) + conv;
        r.aiBySource[src] = (r.aiBySource[src] ?? 0) + sessions;
      }
    }
  }

  for (const [date, data] of rows) await Traffic.updateOne({ clientId, date }, { $set: data }, { upsert: true });
  if (rows.size) await logActivity(clientId, "traffic", `Synced ${rows.size} days of Search Console and GA4 data.`, "/app/traffic");
  return { synced: rows.size };
}
