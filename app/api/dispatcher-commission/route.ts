import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { getUserById, updateUser } from "@/lib/auth";

// Owner sets a sub-dispatcher's commission percentage (0..100).
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 });
  }
  const isOwner = me.role === "admin" || (me.role === "dispatcher" && !me.ownerId);
  if (!isOwner) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const { id, pct } = await req.json().catch(() => ({ id: "", pct: 0 }));
  const target = getUserById(String(id || ""));
  if (!target || target.role !== "dispatcher") {
    return NextResponse.json({ ok: false, error: "Dispatcher not found." }, { status: 404 });
  }
  // The dispatcher must belong to this owner, or be the owner themselves
  // (admins may set anyone).
  if (me.role !== "admin" && target.id !== me.id && target.ownerId !== me.id) {
    return NextResponse.json({ ok: false, error: "Not your dispatcher." }, { status: 403 });
  }
  let value = Number(pct);
  if (!Number.isFinite(value)) value = 0;
  value = Math.max(0, Math.min(100, Math.round(value * 100) / 100));

  updateUser(target.id, { commissionPct: value });
  return NextResponse.json({ ok: true, pct: value });
}
