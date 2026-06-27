import { NextResponse } from "next/server";
import { createSession, findByEmail } from "@/lib/auth";
import { corsHeaders } from "@/lib/mobile-auth";
import { verifyChallenge, makeTrust } from "@/lib/twofa";

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders() });
}

// POST /api/driver/login/verify { email, code, challenge } — second step of 2FA.
export async function POST(req: Request) {
  const h = corsHeaders();
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const code = String(body.code || "").trim();
    const challenge = typeof body.challenge === "string" ? body.challenge : undefined;

    if (!email || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ ok: false, error: "Enter the 6-digit code." }, { status: 400, headers: h });
    }
    if (!verifyChallenge(challenge, email, code)) {
      return NextResponse.json({ ok: false, error: "Incorrect or expired code." }, { status: 401, headers: h });
    }

    const user = findByEmail(email);
    if (!user || user.role !== "driver") {
      return NextResponse.json({ ok: false, error: "Account not found." }, { status: 404, headers: h });
    }

    const token = createSession({ id: user.id, name: user.name, email: user.email, role: "driver" });
    return NextResponse.json(
      {
        ok: true,
        token,
        driver: { id: user.id, name: user.name, email: user.email },
        // 30-day trust token the app stores; each login refreshes it.
        trust: makeTrust(user.email, 30),
      },
      { headers: h }
    );
  } catch {
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500, headers: h });
  }
}
