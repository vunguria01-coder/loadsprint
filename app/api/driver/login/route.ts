import { NextResponse } from "next/server";
import { createSession, findByEmail, verifyPassword } from "@/lib/auth";
import { corsHeaders } from "@/lib/mobile-auth";

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders() });
}

export async function POST(req: Request) {
  const h = corsHeaders();
  try {
    const { email, password } = await req.json();
    const user = findByEmail(String(email || ""));
    if (!user || user.role !== "driver" || !verifyPassword(String(password || ""), user.salt, user.hash)) {
      return NextResponse.json(
        { ok: false, error: "Invalid email or password." },
        { status: 401, headers: h }
      );
    }
    const token = createSession({ id: user.id, name: user.name, email: user.email, role: "driver" });
    return NextResponse.json(
      { ok: true, token, driver: { id: user.id, name: user.name, email: user.email } },
      { headers: h }
    );
  } catch {
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500, headers: h });
  }
}
