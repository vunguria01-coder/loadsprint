import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { hasActiveSub } from "@/lib/auth";
import { createLoad } from "@/lib/loads";

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Sign in" }, { status: 401 });
  if (me.role !== "dispatcher" && me.role !== "admin")
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (me.role === "dispatcher" && !hasActiveSub(me))
    return NextResponse.json({ ok: false, error: "Activate a plan first." }, { status: 402 });

  const body = await req.json().catch(() => ({}));
  const driverEmail = String(body.driverEmail || "").trim();
  const driverName = String(body.driverName || "").trim();
  const originName = String(body.originName || "").trim();
  const destName = String(body.destName || "").trim();
  if (!driverEmail || !originName || !destName) {
    return NextResponse.json(
      { ok: false, error: "Driver, origin and destination are required." },
      { status: 400 }
    );
  }
  const load = createLoad({
    dispatcherId: me.id,
    ref: body.ref ? String(body.ref) : undefined,
    driverName: driverName || driverEmail,
    driverEmail,
    originName,
    destName,
    brokerName: body.brokerName ? String(body.brokerName) : undefined,
    brokerEmail: body.brokerEmail ? String(body.brokerEmail) : undefined,
    brokerPhone: body.brokerPhone ? String(body.brokerPhone) : undefined,
  });
  return NextResponse.json({ ok: true, load: { id: load.id, ref: load.ref } });
}
