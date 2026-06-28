import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { findByEmail, deleteUser } from "@/lib/auth";
import { getInvitesByRole, deleteInvite } from "@/lib/invites";

// Owner removes a sub-dispatcher: deletes their dispatcher account (only if it
// belongs to this owner) and the owner's dispatcher invite for that email.
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 });
  }
  const isOwner = me.role === "admin" || (me.role === "dispatcher" && !me.ownerId);
  if (!isOwner) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const { email } = await req.json().catch(() => ({ email: "" }));
  const target = String(email || "").trim().toLowerCase();
  if (!target) {
    return NextResponse.json({ ok: false, error: "Missing email" }, { status: 400 });
  }

  // Delete the owner's dispatcher invite(s) for that email.
  const mine = getInvitesByRole(me.id, "dispatcher").filter(
    (i) => i.email.toLowerCase() === target
  );
  for (const inv of mine) deleteInvite(inv.id, me.id, me.role === "admin");

  // Delete the sub-dispatcher account, but only if it belongs to this owner.
  const user = findByEmail(target);
  if (
    user &&
    user.role === "dispatcher" &&
    (me.role === "admin" || user.ownerId === me.id)
  ) {
    deleteUser(user.id);
  } else if (mine.length === 0) {
    return NextResponse.json(
      { ok: false, error: "This dispatcher isn't on your team." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
