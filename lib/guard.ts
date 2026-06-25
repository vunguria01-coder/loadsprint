import { cookies } from "next/headers";
import {
  readSession,
  getUserById,
  SESSION_COOKIE,
  type SessionData,
  type User,
} from "@/lib/auth";
import { bearerUser } from "@/lib/mobile-auth";

export async function currentSession(): Promise<SessionData | null> {
  const store = await cookies();
  return readSession(store.get(SESSION_COOKIE)?.value);
}

export async function currentUser(): Promise<User | null> {
  const session = await currentSession();
  if (!session) return null;
  return getUserById(session.id) ?? null;
}

// Resolve the signed-in user from EITHER a mobile "Authorization: Bearer <token>"
// header (native app) OR the web session cookie. Use this in any route the
// mobile app calls so the same endpoint serves both the website and the app.
export async function requestUser(req: Request): Promise<User | null> {
  const viaBearer = bearerUser(req);
  if (viaBearer) return viaBearer;
  return currentUser();
}
