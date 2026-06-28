import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { findByEmail, deleteUser } from "@/lib/auth";
import { getInvitesByRole, deleteInvite } from "@/lib/invites";

// Remove a driver from this dispatcher's roster: deletes the dispatcher's
// invite(s) for that email and the driver's user account (frees the seat).
// Loads already created keep their historical record.
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 });
  }
  if (me.role !== "dispatcher" && me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const { email } = await req.json().catch(() => ({ email: "" }));
  const target = String(email || "").trim().toLowerCase();
  if (!target) {
    return NextResponse.json({ ok: false, error: "Missing email" }, { status: 400 });
  }

  // Delete this dispatcher's driver invites for that email.
  const mine = getInvitesByRole(me.id, "driver").filter(
    (i) => i.email.toLowerCase() === target
  );
  if (mine.length === 0 && me.role !== "admin") {
    return NextResponse.json(
      { ok: false, error: "This driver isn't on your roster." },
      { status: 404 }
    );
  }
  for (const inv of mine) deleteInvite(inv.id, me.id, me.role === "admin");

  // Delete the driver account if it exists and is actually a driver.
  const user = findByEmail(target);
  if (user && user.role === "driver") deleteUser(user.id);

  return NextResponse.json({ ok: true });
}
