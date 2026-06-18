import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/schemas";
import {
  createSession,
  ensureSeed,
  findByEmail,
  SESSION_COOKIE,
  verifyPassword,
} from "@/lib/auth";

export async function POST(req: Request) {
  try {
    ensureSeed();
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
    const token = createSession({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
    const res = NextResponse.json({ ok: true, role: user.role });
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
