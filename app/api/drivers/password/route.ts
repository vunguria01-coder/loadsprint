import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { findByEmail, updateUser, hashPassword } from "@/lib/auth";
import { getInvitesByRole } from "@/lib/invites";

// POST /api/drivers/password  { email, password }
// Lets a dispatcher set a new password for one of their own drivers (admin: any
// driver). Useful when a driver is locked out. The dispatcher must have invited
// the driver.
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 });
  }
  if (me.role !== "dispatcher" && me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { email, password } = await req.json().catch(() => ({}));
  const target = String(email || "").trim().toLowerCase();
  const pw = String(password || "");
  if (!target) {
    return NextResponse.json({ ok: false, error: "Missing email" }, { status: 400 });
  }
  if (pw.length < 6) {
    return NextResponse.json(
      { ok: false, error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }

  // Ownership: this dispatcher must have invited the driver (admin exempt).
  const owns = getInvitesByRole(me.id, "driver").some(
    (i) => i.email.toLowerCase() === target
  );
  if (!owns && me.role !== "admin") {
    return NextResponse.json(
      { ok: false, error: "This driver isn't on your roster." },
      { status: 404 }
    );
  }

  const user = findByEmail(target);
  if (!user || user.role !== "driver") {
    return NextResponse.json({ ok: false, error: "Driver account not found." }, { status: 404 });
  }

  const { salt, hash } = hashPassword(pw);
  updateUser(user.id, { salt, hash });
  return NextResponse.json({ ok: true });
}
