import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { setDriverPay } from "@/lib/driver-pay";

// A dispatcher sets how much a driver is paid: a percentage of each load's
// rate, or a flat amount per delivered load.
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 });
  }
  if (me.role !== "dispatcher" && me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const { email, type, rate } = await req.json().catch(() => ({}));
  const e = String(email || "").trim().toLowerCase();
  if (!e) {
    return NextResponse.json({ ok: false, error: "Driver email required." }, { status: 400 });
  }
  const t: "pct" | "flat" = type === "flat" ? "flat" : "pct";
  let r = Number(rate);
  if (!Number.isFinite(r) || r < 0) r = 0;
  if (t === "pct") r = Math.min(100, r);
  r = Math.round(r * 100) / 100;

  const ownerId = me.ownerId || me.id;
  setDriverPay(ownerId, e, t, r);
  return NextResponse.json({ ok: true, type: t, rate: r });
}
