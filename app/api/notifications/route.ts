import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { getNotifications, markNotificationsRead } from "@/lib/loads";

export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false, items: [] }, { status: 401 });
  const items = getNotifications(me.id);
  return NextResponse.json({
    ok: true,
    items,
    unread: items.filter((n) => !n.read).length,
  });
}

export async function POST() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  markNotificationsRead(me.id);
  return NextResponse.json({ ok: true });
}
