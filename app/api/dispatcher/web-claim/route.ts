import { NextResponse } from "next/server";
import {
  addUser,
  createSession,
  findByEmail,
  getUserById,
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
    // Must be a dispatcher-seat invite specifically.
    if (!invite || invite.role !== "dispatcher") {
      return NextResponse.json(
        { ok: false, error: "Invalid or already-used dispatcher invite code." },
        { status: 400 }
      );
    }
    if (findByEmail(invite.email)) {
      return NextResponse.json(
        { ok: false, error: "An account already exists for this email. Please sign in." },
        { status: 409 }
      );
    }
    const owner = getUserById(invite.createdBy);
    if (!owner) {
      return NextResponse.json(
        { ok: false, error: "The inviting account no longer exists." },
        { status: 400 }
      );
    }
    const { salt, hash } = hashPassword(String(password));
    const id = newId();
    addUser({
      id,
      name: String(name),
      company: owner.company || "",
      email: invite.email,
      role: "dispatcher",
      tier: "none", // access is inherited from the owner via ownerId
      ownerId: owner.id,
      canFreezeLocation: false,
      freezeActive: false,
      salt,
      hash,
      createdAt: new Date().toISOString(),
    });
    claimInvite(String(code));
    const token = createSession({ id, name: String(name), email: invite.email, role: "dispatcher" });
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
