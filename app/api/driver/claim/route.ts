import { NextResponse } from "next/server";
import {
  addUser,
  createSession,
  findByEmail,
  hashPassword,
  newId,
} from "@/lib/auth";
import { claimInvite, verifyCode } from "@/lib/invites";
import { corsHeaders } from "@/lib/mobile-auth";

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders() });
}

export async function POST(req: Request) {
  const h = corsHeaders();
  try {
    const { code, name, password } = await req.json();
    if (!code || !name || !password || String(password).length < 6) {
      return NextResponse.json(
        { ok: false, error: "Enter your code, name and a password (6+ chars)." },
        { status: 400, headers: h }
      );
    }
    const invite = verifyCode(String(code));
    if (!invite) {
      return NextResponse.json(
        { ok: false, error: "Invalid or already-used invite code." },
        { status: 400, headers: h }
      );
    }
    if (findByEmail(invite.email)) {
      return NextResponse.json(
        { ok: false, error: "An account already exists for this email. Please sign in." },
        { status: 409, headers: h }
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
    return NextResponse.json(
      { ok: true, token, driver: { id, name, email: invite.email } },
      { headers: h }
    );
  } catch {
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500, headers: h });
  }
}
