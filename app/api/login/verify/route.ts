import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSession, findByEmail, SESSION_COOKIE } from "@/lib/auth";
import { verifyChallenge, makeTrust, TWOFA_COOKIE, TRUST_COOKIE } from "@/lib/twofa";

// POST /api/login/verify { email, code } — second step of 2FA login.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const code = String(body.code || "").trim();
    if (!email || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ ok: false, error: "Enter the 6-digit code." }, { status: 400 });
    }

    const jar = await cookies();
    const challenge = jar.get(TWOFA_COOKIE)?.value;
    if (!verifyChallenge(challenge, email, code)) {
      return NextResponse.json({ ok: false, error: "Incorrect or expired code." }, { status: 401 });
    }

    const user = findByEmail(email);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Account not found." }, { status: 404 });
    }

    const token = createSession({ id: user.id, name: user.name, email: user.email, role: user.role });
    const res = NextResponse.json({ ok: true, role: user.role });
    // Sign in.
    res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    // Trust this device for 30 days. Each later sign-in refreshes the 30 days, so
    // the device is forgotten only after 30 days with no login.
    res.cookies.set(TRUST_COOKIE, makeTrust(user.email), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    // Clear the one-time challenge.
    res.cookies.set(TWOFA_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "Server error." }, { status: 500 });
  }
}
