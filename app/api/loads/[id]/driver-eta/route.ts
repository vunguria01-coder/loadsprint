import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { getLoadById } from "@/lib/loads";
import { truckRoute, geocodeHere } from "@/lib/here";

function canAccess(me: { id: string; email: string; role: string }, load: any) {
  return (
    me.role === "admin" ||
    load.dispatcherId === me.id ||
    load.driverEmail.toLowerCase() === me.email.toLowerCase() ||
    load.brokerEmail.toLowerCase() === me.email.toLowerCase()
  );
}

// GET → distance/ETA from the driver's live GPS to pickup AND delivery.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await params;
  const load = getLoadById(id);
  if (!load) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (!canAccess(me, load)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const from = load.driverPoint;
  if (!from) return NextResponse.json({ ok: true, hasGps: false });

  const [toPickup, toDelivery] = await Promise.all([
    truckRoute(from, load.origin, {}),
    truckRoute(from, load.dest, {}),
  ]);
  return NextResponse.json({
    ok: true,
    hasGps: true,
    toPickup: toPickup
      ? { miles: toPickup.distanceMeters / 1609.34, etaSeconds: toPickup.durationSeconds }
      : null,
    toDelivery: toDelivery
      ? { miles: toDelivery.distanceMeters / 1609.34, etaSeconds: toDelivery.durationSeconds }
      : null,
  });
}

// POST { address } → distance/ETA from the driver's GPS to any typed address.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await params;
  const load = getLoadById(id);
  if (!load) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (!canAccess(me, load)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const address = String(body.address || "").trim();
  if (!address) return NextResponse.json({ ok: false, error: "Address required" }, { status: 400 });

  const from = load.driverPoint;
  if (!from) return NextResponse.json({ ok: true, hasGps: false });

  const point = await geocodeHere(address);
  if (!point) return NextResponse.json({ ok: false, error: "Address not found" }, { status: 422 });

  const r = await truckRoute(from, point, {});
  if (!r) return NextResponse.json({ ok: false, error: "No route" }, { status: 502 });
  return NextResponse.json({
    ok: true,
    hasGps: true,
    label: address,
    miles: r.distanceMeters / 1609.34,
    etaSeconds: r.durationSeconds,
  });
}
