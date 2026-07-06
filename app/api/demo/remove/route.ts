import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { removeDispatcherDemo } from "@/lib/demo";

// POST /api/demo/remove — wipe this dispatcher's sample data.
export async function POST() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 });
  if (me.role !== "dispatcher") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  removeDispatcherDemo(me);
  return NextResponse.json({ ok: true });
}
