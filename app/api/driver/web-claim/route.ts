import { NextResponse } from "next/server";
import {
  addUser,
  createSession,
  findByEmail,
  hashPassword,
  verifyPassword,
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
    // An account already exists for this email. Instead of blocking, let an
    // existing driver CONNECT to this (additional) dispatcher by verifying their
    // current password. Loads from any dispatcher already reach a driver by
    // email, so "joining" just means claiming this invite — no new account.
    const existing = findByEmail(invite.email);
    if (existing) {
      if (existing.role !== "driver") {
        return NextResponse.json(
          {
            ok: false,
            error:
              "This email is already registered to a non-driver account. Use a different email.",
          },
          { status: 409 }
        );
      }
      if (!verifyPassword(String(password), existing.salt, existing.hash)) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "An account already exists for this email — enter your existing password to connect.",
          },
          { status: 401 }
        );
      }
      // Link this already-registered driver to the new dispatcher.
      claimInvite(String(code));
      const token = createSession({
        id: existing.id,
        name: existing.name,
        email: existing.email,
        role: "driver",
      });
      const res = NextResponse.json({ ok: true, linked: true });
      res.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
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
