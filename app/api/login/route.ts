import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { loginSchema } from "@/lib/schemas";
import {
  createSession,
  ensureSeed,
  findByEmail,
  SESSION_COOKIE,
  verifyPassword,
} from "@/lib/auth";
import { sendEmail, twoFactorEmail } from "@/lib/email";
import { genCode, makeChallenge, makeTrust, verifyTrust, TWOFA_COOKIE, TRUST_COOKIE } from "@/lib/twofa";
import { ensureDemo } from "@/lib/seed-demo";

export async function POST(req: Request) {
  try {
    ensureSeed();
    ensureDemo();
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid email and password." },
        { status: 400 }
      );
    }
    const { email, password } = parsed.data;
    const user = findByEmail(email);
    if (!user || !verifyPassword(password, user.salt, user.hash)) {
      return NextResponse.json(
        { ok: false, error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // 2FA is gated by an env flag so it can be turned on/off without a code change.
    // While the sending domain warms up, leave TWOFA_ENABLED unset to skip codes.
    const twoFaOn = process.env.TWOFA_ENABLED === "true";

    // Trusted device, or 2FA disabled → sign in straight away.
    const jar = await cookies();
    const trust = jar.get(TRUST_COOKIE)?.value;
    if (!twoFaOn || verifyTrust(trust, user.email)) {
      const token = createSession({ id: user.id, name: user.name, email: user.email, role: user.role });
      const res = NextResponse.json({ ok: true, role: user.role });
      res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
      // Refresh the 30-day trust window on every successful sign-in.
      res.cookies.set(TRUST_COOKIE, makeTrust(user.email), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
      return res;
    }

    // Not trusted → send a 6-digit code by email and stash a signed challenge.
    const code = genCode();
    const challenge = makeChallenge(user.email, code);
    const mail = twoFactorEmail(code);
    const sent = await sendEmail({ to: user.email, subject: mail.subject, html: mail.html, text: mail.text });

    const res = NextResponse.json({
      ok: true,
      need2fa: true,
      // If email isn't configured, surface that honestly so it isn't a silent dead-end.
      emailed: sent.ok,
      emailSkipped: sent.skipped === true,
    });
    res.cookies.set(TWOFA_COOKIE, challenge, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "Server error." }, { status: 500 });
  }
}
