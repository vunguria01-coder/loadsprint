import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { getLoadById } from "@/lib/loads";
import { truckRoute } from "@/lib/here";

export const dynamic = "force-dynamic";

// TEMP: route Grand Rapids MI -> Manitowoc WI with and without avoid[features]=ferry
// to confirm the param actually keeps the truck off the Lake Michigan ferry.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await params;
  const load = getLoadById(id);
  if (!load) return NextResponse.json({ ok: false }, { status: 404 });
  if (!(me.role === "admin" || load.dispatcherId === me.id))
    return NextResponse.json({ ok: false }, { status: 403 });
  const key = process.env.HERE_API_KEY;
  if (!key) return NextResponse.json({ ok: false, error: "no key" });

  const o = "42.963,-85.668"; // Grand Rapids, MI
  const d = "44.089,-87.658"; // Manitowoc, WI
  const base =
    `https://router.hereapi.com/v8/routes?transportMode=truck&routingMode=fast` +
    `&origin=${o}&destination=${d}&return=summary&units=imperial` +
    `&truck[height]=411&truck[width]=260&truck[length]=2200&truck[grossWeight]=15876&truck[axleCount]=5`;
  const call = async (extra: string) => {
    const res = await fetch(`${base}${extra}&apikey=${key}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    const j = await res.json();
    const s = j?.routes?.[0]?.sections;
    const miles = Array.isArray(s) ? s.reduce((a: number, x: { summary?: { length?: number } }) => a + (x.summary?.length || 0), 0) / 1609.34 : null;
    return { status: res.status, sections: Array.isArray(s) ? s.length : 0, miles: miles ? Math.round(miles) : null, notices: j?.routes?.[0]?.sections?.[0]?.summary ? undefined : (j?.notices || j?.title) };
  };

  const [plain, avoidFerry] = await Promise.all([
    call(""),
    call("&avoid[features]=ferry"),
  ]);
  // The deployed library function — does IT avoid the ferry?
  const lib = await truckRoute({ lat: 42.963, lng: -85.668 }, { lat: 44.089, lng: -87.658 }, {});
  const libMiles = lib ? Math.round(lib.distanceMeters / 1609.34) : null;

  // The actual leg the map builds: driver (Avoca PA) -> Richland WA.
  const leg = await truckRoute({ lat: 41.331, lng: -75.74 }, { lat: 46.319, lng: -119.284 }, {});
  const legMiles = leg ? Math.round(leg.distanceMeters / 1609.34) : null;
  let legLakePts = 0;
  if (leg)
    for (const p of leg.points)
      if (p.lat >= 43.7 && p.lat <= 44.4 && p.lng >= -87.5 && p.lng <= -86.5) legLakePts++;

  return NextResponse.json({
    ok: true,
    marker: "ferry-test-3",
    plain,
    avoidFerry,
    libTruckRouteMiles: libMiles,
    legAvocaToWA: { miles: legMiles, lakeCorridorPts: legLakePts, points: leg ? leg.points.length : 0 },
  });
}
