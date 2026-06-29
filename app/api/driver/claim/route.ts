import { NextResponse } from "next/server";
import {
  addUser,
  createSession,
  findByEmail,
  hashPassword,
  verifyPassword,
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
    // Existing account: let the driver CONNECT to this additional dispatcher by
    // verifying their current password, instead of blocking. Same app screen
    // (code + name + password) — no app rebuild needed.
    const existing = findByEmail(invite.email);
    if (existing) {
      if (existing.role !== "driver") {
        return NextResponse.json(
          {
            ok: false,
            error:
              "This email is already registered to a non-driver account. Use a different email.",
          },
          { status: 409, headers: h }
        );
      }
      if (!verifyPassword(String(password), existing.salt, existing.hash)) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "An account already exists for this email — enter your existing password to connect.",
          },
          { status: 401, headers: h }
        );
      }
      claimInvite(String(code));
      const token = createSession({
        id: existing.id,
        name: existing.name,
        email: existing.email,
        role: "driver",
      });
      return NextResponse.json(
        {
          ok: true,
          linked: true,
          token,
          driver: { id: existing.id, name: existing.name, email: existing.email },
        },
        { headers: h }
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
