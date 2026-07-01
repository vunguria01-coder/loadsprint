import { NextResponse } from "next/server";
import { requestUser } from "@/lib/guard";
import { corsHeaders } from "@/lib/mobile-auth";
import { setDriverGlobalLocation } from "@/lib/driver-location";
import { getLoadsByDriverEmail, setDriverLocation } from "@/lib/loads";

// POST /api/driver/location  { lat, lng }
// The driver app can report GPS here even with no active load. We always store
// the driver's last-known position, and if they do have a live load, we push the
// point onto it so existing tracking keeps working.
export async function POST(req: Request) {
  const me = await requestUser(req);
  if (!me) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401, headers: corsHeaders() }
    );
  }
  if (me.role !== "driver") {
    return NextResponse.json(
      { ok: false, error: "Drivers only" },
      { status: 403, headers: corsHeaders() }
    );
  }

  const body = await req.json().catch(() => ({}));
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { ok: false, error: "Bad coords" },
      { status: 400, headers: corsHeaders() }
    );
  }

  setDriverGlobalLocation(me.email, lat, lng);

  // Push onto the driver's current live load, if any.
  const active = getLoadsByDriverEmail(me.email).find(
    (l) =>
      l.status !== "Delivered" &&
      l.status !== "Closed" &&
      l.driverShareLocation !== false
  );
  if (active) setDriverLocation(active.id, { lat, lng });

  return NextResponse.json({ ok: true }, { headers: corsHeaders() });
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
