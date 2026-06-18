import { readSession, getUserById, type User } from "@/lib/auth";

// Mobile clients send the session token as "Authorization: Bearer <token>".
export function bearerUser(req: Request): User | null {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const session = readSession(token);
  if (!session) return null;
  return getUserById(session.id) ?? null;
}

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
