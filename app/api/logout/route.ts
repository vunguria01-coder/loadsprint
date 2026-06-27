import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  // Note: the trusted-device cookie is intentionally NOT cleared here. The device
  // stays trusted for 30 days of inactivity; logging out doesn't re-trigger 2FA.
  return res;
}
