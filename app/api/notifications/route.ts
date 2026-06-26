import { NextResponse } from "next/server";
import { requestUser } from "@/lib/guard";
import {
  getNotifications,
  markNotificationsRead,
  deleteNotification,
  clearNotifications,
} from "@/lib/loads";
import { corsHeaders } from "@/lib/mobile-auth";

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders() });
}

export async function GET(req: Request) {
  const h = corsHeaders();
  const me = await requestUser(req);
  if (!me) return NextResponse.json({ ok: false, items: [] }, { status: 401, headers: h });
  const items = getNotifications(me.id);
  return NextResponse.json(
    { ok: true, items, unread: items.filter((n) => !n.read).length },
    { headers: h }
  );
}

export async function POST(req: Request) {
  const h = corsHeaders();
  const me = await requestUser(req);
  if (!me) return NextResponse.json({ ok: false }, { status: 401, headers: h });
  markNotificationsRead(me.id);
  return NextResponse.json({ ok: true }, { headers: h });
}

export async function DELETE(req: Request) {
  const h = corsHeaders();
  const me = await requestUser(req);
  if (!me) return NextResponse.json({ ok: false }, { status: 401, headers: h });
  const body = await req.json().catch(() => ({}));
  if (body?.all) {
    clearNotifications(me.id);
  } else if (body?.id) {
    deleteNotification(me.id, String(body.id));
  } else {
    return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400, headers: h });
  }
  return NextResponse.json({ ok: true }, { headers: h });
}
