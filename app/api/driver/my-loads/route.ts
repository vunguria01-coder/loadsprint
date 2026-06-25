import { NextResponse } from "next/server";
import { requestUser } from "@/lib/guard";
import { getLoadsByDriverEmail } from "@/lib/loads";
import { corsHeaders } from "@/lib/mobile-auth";

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders() });
}

export async function GET(req: Request) {
  const h = corsHeaders();
  const me = await requestUser(req);
  if (!me || me.role !== "driver") {
    return NextResponse.json({ ok: false }, { status: 401, headers: h });
  }
  const loads = getLoadsByDriverEmail(me.email).map((l) => ({
    id: l.id,
    ref: l.ref,
    originName: l.originName,
    destName: l.destName,
    status: l.status,
    docCount: l.documents.length,
    photoCount: l.photos.length,
    sharing: l.driverShareLocation !== false,
  }));
  return NextResponse.json({ ok: true, loads, name: me.name }, { headers: h });
}
