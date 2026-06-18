import { NextResponse } from "next/server";
import { updateUser } from "@/lib/auth";
import { currentUser } from "@/lib/guard";

export async function POST() {
  const me = await currentUser();
  if (!me || !me.canFreezeLocation) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const updated = updateUser(me.id, { freezeActive: !me.freezeActive });
  return NextResponse.json({ ok: true, freezeActive: updated?.freezeActive ?? false });
}
