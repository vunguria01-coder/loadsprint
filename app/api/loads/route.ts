import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { hasAccess } from "@/lib/auth";
import { createLoad, type Stop } from "@/lib/loads";
import { geocodeHere } from "@/lib/here";

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Sign in" }, { status: 401 });
  if (me.role !== "dispatcher" && me.role !== "admin")
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (me.role === "dispatcher" && !hasAccess(me))
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

  // Optional multi-stop list (pickups + dropoffs). Geocode each address so the
  // map and navigation work for every stop.
  let stops: Stop[] | undefined;
  if (Array.isArray(body.stops) && body.stops.length > 0) {
    const raw = body.stops
      .filter((s: unknown) => s && typeof s === "object")
      .slice(0, 30) as Array<{ kind?: string; address?: string; time?: string }>;
    const geocoded = await Promise.all(
      raw.map(async (s) => {
        const address = String(s.address || "").trim();
        if (!address) return null;
        const point = (await geocodeHere(address)) || undefined;
        const stop: Stop = {
          id: crypto.randomUUID(),
          kind: s.kind === "dropoff" ? "dropoff" : "pickup",
          address,
          time: s.time ? String(s.time) : undefined,
          point,
          done: false,
        };
        return stop;
      })
    );
    stops = geocoded.filter((s): s is Stop => s !== null);
    if (stops.length === 0) stops = undefined;
  }

  const load = createLoad({
    dispatcherId: me.id,
    ref: body.ref ? String(body.ref) : undefined,
    driverName: driverName || driverEmail,
    driverEmail,
    originName,
    destName,
    rate: Number(body.rate) > 0 ? Number(body.rate) : undefined,
    stops,
    billTo: body.billTo ? String(body.billTo) : undefined,
    brokerContactName: body.brokerContactName ? String(body.brokerContactName) : undefined,
    brokerContactEmail: body.brokerContactEmail ? String(body.brokerContactEmail) : undefined,
    brokerContactPhone: body.brokerContactPhone ? String(body.brokerContactPhone) : undefined,
  });
  return NextResponse.json({ ok: true, load: { id: load.id, ref: load.ref } });
}
