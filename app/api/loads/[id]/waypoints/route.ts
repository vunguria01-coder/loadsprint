import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { getLoadById } from "@/lib/loads";
import { truckRoute } from "@/lib/here";
import { ensureStopsGeocoded } from "@/lib/geocode-stops";

// GET /api/loads/[id]/waypoints
// Returns the ordered stops (pickup → drops → delivery) with coordinates, and a
// truck route that threads through every stop in order. Used to draw the real
// "where the driver is going" line plus numbered, labelled stop markers.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await params;
  let load = getLoadById(id);
  if (!load) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const can =
    me.role === "admin" ||
    load.dispatcherId === me.id ||
    load.driverEmail.toLowerCase() === me.email.toLowerCase() ||
    load.brokerEmail.toLowerCase() === me.email.toLowerCase();
  if (!can) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  // Backfill any stop coordinates that are missing so every stop can be drawn.
  load = await ensureStopsGeocoded(load);

  type WP = { kind: "pickup" | "dropoff"; address: string; lat: number; lng: number };
  let waypoints: WP[] = [];
  if (load.stops && load.stops.length > 0) {
    waypoints = load.stops
      .filter((s) => s.point)
      .map((s) => ({
        kind: s.kind,
        address: s.address,
        lat: s.point!.lat,
        lng: s.point!.lng,
      }));
  }
  // No multi-stop list (or none geocoded) → use origin as pickup, dest as delivery.
  if (waypoints.length < 2) {
    waypoints = [
      { kind: "pickup", address: load.originName, lat: load.origin.lat, lng: load.origin.lng },
      { kind: "dropoff", address: load.destName, lat: load.dest.lat, lng: load.dest.lng },
    ];
  }

  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];
  const mids = waypoints.slice(1, -1).map((w) => ({ lat: w.lat, lng: w.lng }));
  const r = await truckRoute(
    { lat: first.lat, lng: first.lng },
    { lat: last.lat, lng: last.lng },
    { via: mids }
  );

  return NextResponse.json({
    ok: true,
    waypoints,
    points: r?.points ?? null,
    distanceMeters: r?.distanceMeters ?? null,
  });
}
