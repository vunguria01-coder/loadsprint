import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { setLoadSchedule } from "@/lib/loads";

// A dispatcher schedules a load's pickup/delivery dates (shown on the calendar).
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 });
  }
  if (me.role !== "dispatcher" && me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const { id, pickupDate, deliveryDate } = await req.json().catch(() => ({}));
  if (!id) {
    return NextResponse.json({ ok: false, error: "Load id required." }, { status: 400 });
  }
  const updated = setLoadSchedule(
    String(id),
    me.id,
    typeof pickupDate === "string" ? pickupDate : undefined,
    typeof deliveryDate === "string" ? deliveryDate : undefined,
    me.role === "admin"
  );
  if (!updated) {
    return NextResponse.json({ ok: false, error: "Load not found." }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    pickupDate: updated.pickupDate || null,
    deliveryDate: updated.deliveryDate || null,
  });
}
