import { cookies } from "next/headers";
import {
  readSession,
  getUserById,
  SESSION_COOKIE,
  type SessionData,
  type User,
} from "@/lib/auth";

export async function currentSession(): Promise<SessionData | null> {
  const store = await cookies();
  return readSession(store.get(SESSION_COOKIE)?.value);
}

export async function currentUser(): Promise<User | null> {
  const session = await currentSession();
  if (!session) return null;
  return getUserById(session.id) ?? null;
}
