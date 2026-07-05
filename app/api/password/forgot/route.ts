import { NextResponse } from "next/server";
import { forgotSchema } from "@/lib/schemas";
import { ensureSeed, findByEmail } from "@/lib/auth";
import { ensureDemo } from "@/lib/seed-demo";
import { sendEmail, passwordResetEmail } from "@/lib/email";
import { genCode, makeChallenge, RESET_COOKIE } from "@/lib/twofa";

export async function POST(req: Request) {
  try {
    ensureSeed();
    ensureDemo();
    const body = await req.json();
    const parsed = forgotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid email." },
        { status: 400 }
      );
    }
    const { email } = parsed.data;
    const user = findByEmail(email);

    // Respond the same way whether or not the account exists, so this endpoint
    // can't be used to discover which emails are registered.
    if (!user) {
      return NextResponse.json({ ok: true, emailed: false, emailSkipped: false });
    }

    const code = genCode();
    const challenge = makeChallenge(user.email, code);
    const mail = passwordResetEmail(code);
    const sent = await sendEmail({
      to: user.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });

    // When email isn't configured the code can't be delivered, so there's no
    // way to complete a reset. Outside production only, hand the code back so
    // local/demo testing isn't a dead end. Production never leaks it.
    const devCode =
      process.env.NODE_ENV !== "production" && sent.skipped ? code : undefined;

    const res = NextResponse.json({
      ok: true,
      emailed: sent.ok,
      emailSkipped: sent.skipped === true,
      ...(devCode ? { devCode } : {}),
    });
    res.cookies.set(RESET_COOKIE, challenge, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "Server error." }, { status: 500 });
  }
}
