import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth";
import { env } from "@/lib/env";
import { Client, logActivity } from "@/lib/models";
import { exchangeCode } from "@/lib/services/google";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (q: string) => NextResponse.redirect(`${env.appUrl()}/app/settings?google=${q}`);
  const jar = await cookies();
  const [state, clientId] = (jar.get("mq_gstate")?.value ?? "").split(".");
  jar.delete("mq_gstate");
  if (!state || state !== url.searchParams.get("state")) return back("state");
  const { client } = await requireClient();
  if (String(client._id) !== clientId) return back("state");
  const code = url.searchParams.get("code");
  if (!code) return back("denied");
  try {
    const t = await exchangeCode(code);
    if (!t.refresh_token) return back("norefresh");
    const email = t.id_token ? JSON.parse(Buffer.from(t.id_token.split(".")[1], "base64url").toString()).email ?? "" : "";
    await Client.updateOne(
      { _id: client._id },
      { "integrations.google.refreshToken": t.refresh_token, "integrations.google.email": email, "integrations.google.connectedAt": new Date() },
    );
    await logActivity(client._id, "account", `Connected Google (${email || "Search Console + GA4"}).`);
    return back("connected");
  } catch {
    return back("error");
  }
}
