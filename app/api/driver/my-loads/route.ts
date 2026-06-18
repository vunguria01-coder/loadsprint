import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { getLoadsByDriverEmail } from "@/lib/loads";

export async function GET() {
  const me = await currentUser();
  if (!me || me.role !== "driver") {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const loads = getLoadsByDriverEmail(me.email).map((l) => ({
    id: l.id,
    ref: l.ref,
    originName: l.originName,
    destName: l.destName,
    status: l.status,
    docCount: l.documents.length,
    photoCount: l.photos.length,
  }));
  return NextResponse.json({ ok: true, loads, name: me.name });
}
