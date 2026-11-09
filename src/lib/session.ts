import { SignJWT, jwtVerify } from "jose";

/** Edge-safe session token helpers (used by middleware and server code). */
export const SESSION_COOKIE = "mq_session";
export const VIEW_AS_COOKIE = "mq_view";

export interface SessionPayload {
  uid: string;
  role: "client" | "admin";
}

const key = () =>
  new TextEncoder().encode(process.env.AUTH_SECRET || "dev-only-insecure-secret-change-me-please-0000");

export async function signSession(p: SessionPayload) {
  return new SignJWT({ ...p }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30d").sign(key());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (typeof payload.uid !== "string") return null;
    return { uid: payload.uid, role: payload.role === "admin" ? "admin" : "client" };
  } catch {
    return null;
  }
}
