import { NextResponse } from "next/server";
import {
  addUser,
  createSession,
  findByEmail,
  hashPassword,
  newId,
  SESSION_COOKIE,
} from "@/lib/auth";
import { claimInvite, verifyCode } from "@/lib/invites";

export async function POST(req: Request) {
  try {
    const { code, name, password } = await req.json();
    if (!code || !name || !password || String(password).length < 6) {
      return NextResponse.json(
        { ok: false, error: "Enter your code, name and a password (6+ chars)." },
        { status: 400 }
      );
    }
    const invite = verifyCode(String(code));
    if (!invite || invite.role === "dispatcher") {
      return NextResponse.json(
        { ok: false, error: "Invalid or already-used invite code." },
        { status: 400 }
      );
    }
    if (findByEmail(invite.email)) {
      return NextResponse.json(
        { ok: false, error: "An account already exists for this email. Please sign in." },
        { status: 409 }
      );
    }
    const { salt, hash } = hashPassword(String(password));
    const id = newId();
    addUser({
      id,
      name: String(name),
      company: "",
      email: invite.email,
      role: "driver",
      tier: "none",
      canFreezeLocation: false,
      freezeActive: false,
      salt,
      hash,
      createdAt: new Date().toISOString(),
    });
    claimInvite(String(code));
    const token = createSession({ id, name: String(name), email: invite.email, role: "driver" });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
