import { NextResponse } from "next/server";
import { bearerUser, corsHeaders } from "@/lib/mobile-auth";
import { getLoadsByDriverEmail } from "@/lib/loads";

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders() });
}

export async function GET(req: Request) {
  const h = corsHeaders();
  const me = bearerUser(req);
  if (!me) return NextResponse.json({ ok: false }, { status: 401, headers: h });
  const loads = getLoadsByDriverEmail(me.email).map((l) => ({
    id: l.id,
    ref: l.ref,
    originName: l.originName,
    destName: l.destName,
    status: l.status,
    docCount: l.documents.length,
    photoCount: l.photos.length,
  }));
  return NextResponse.json({ ok: true, loads }, { headers: h });
}
