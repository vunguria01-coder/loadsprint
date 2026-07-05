import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resetSchema } from "@/lib/schemas";
import { findByEmail, hashPassword, updateUser } from "@/lib/auth";
import { verifyChallenge, RESET_COOKIE } from "@/lib/twofa";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = resetSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || "Check the form and try again.";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }
    const { email, code, password } = parsed.data;

    const jar = await cookies();
    const challenge = jar.get(RESET_COOKIE)?.value;
    if (!verifyChallenge(challenge, email, code)) {
      return NextResponse.json(
        { ok: false, error: "Incorrect or expired code. Request a new one." },
        { status: 400 }
      );
    }

    const user = findByEmail(email);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Account not found." }, { status: 404 });
    }

    const { salt, hash } = hashPassword(password);
    updateUser(user.id, { salt, hash });

    // Burn the challenge so the same code can't be reused.
    const res = NextResponse.json({ ok: true });
    res.cookies.set(RESET_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "Server error." }, { status: 500 });
  }
}
