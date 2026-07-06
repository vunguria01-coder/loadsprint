import { NextResponse } from "next/server";
import { registerSchema } from "@/lib/schemas";
import { gmailBlocked, GMAIL_BLOCKED_MESSAGE } from "@/lib/email";
import {
  addUser,
  createSession,
  findByEmail,
  hashPassword,
  newId,
  SESSION_COOKIE,
} from "@/lib/auth";
import { ensureDispatcherDemo } from "@/lib/demo";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Please check the form and try again." },
        { status: 400 }
      );
    }
    const { role, name, company, email, password } = parsed.data;
    const normEmail = email.trim().toLowerCase();

    if (gmailBlocked(normEmail)) {
      return NextResponse.json(
        { ok: false, error: GMAIL_BLOCKED_MESSAGE },
        { status: 400 }
      );
    }

    if (findByEmail(normEmail)) {
      return NextResponse.json(
        { ok: false, error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const { salt, hash } = hashPassword(password);
    const id = newId();
    addUser({
      id,
      name,
      company: company ?? "",
      email: normEmail,
      role,
      tier: "none",
      canFreezeLocation: false,
      freezeActive: false,
      salt,
      hash,
      createdAt: new Date().toISOString(),
    });

    // New dispatcher → seed removable sample data so the app isn't empty.
    if (role === "dispatcher") ensureDispatcherDemo({ id, name });

    const token = createSession({ id, name, email: normEmail, role });
    const res = NextResponse.json({ ok: true, role });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "Server error." }, { status: 500 });
  }
}
