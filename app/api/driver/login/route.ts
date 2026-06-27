import { NextResponse } from "next/server";
import { createSession, ensureSeed, findByEmail, verifyPassword } from "@/lib/auth";
import { corsHeaders } from "@/lib/mobile-auth";
import { sendEmail, twoFactorEmail } from "@/lib/email";
import { genCode, makeChallenge, makeTrust, verifyTrust } from "@/lib/twofa";

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders() });
}

export async function POST(req: Request) {
  const h = corsHeaders();
  try {
    ensureSeed();
    const body = await req.json();
    const email = String(body.email || "");
    const password = String(body.password || "");
    const trust = typeof body.trust === "string" ? body.trust : undefined;

    const user = findByEmail(email);
    if (!user || user.role !== "driver" || !verifyPassword(password, user.salt, user.hash)) {
      return NextResponse.json(
        { ok: false, error: "Invalid email or password." },
        { status: 401, headers: h }
      );
    }

    // Trusted device → sign in immediately and refresh the 30-day trust window.
    if (verifyTrust(trust, user.email)) {
      const token = createSession({ id: user.id, name: user.name, email: user.email, role: "driver" });
      return NextResponse.json(
        { ok: true, token, driver: { id: user.id, name: user.name, email: user.email }, trust: makeTrust(user.email, 30) },
        { headers: h }
      );
    }

    // Otherwise email a 6-digit code and return a signed challenge for step 2.
    const code = genCode();
    const challenge = makeChallenge(user.email, code);
    const mail = twoFactorEmail(code);
    const sent = await sendEmail({ to: user.email, subject: mail.subject, html: mail.html, text: mail.text });

    return NextResponse.json(
      {
        ok: true,
        need2fa: true,
        challenge,
        email: user.email,
        emailed: sent.ok,
        emailSkipped: sent.skipped === true,
      },
      { headers: h }
    );
  } catch {
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500, headers: h });
  }
}
