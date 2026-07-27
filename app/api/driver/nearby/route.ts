import { NextResponse } from "next/server";
import { requestUser } from "@/lib/guard";
import { corsHeaders } from "@/lib/mobile-auth";
import { getDriverGlobalLocation } from "@/lib/driver-location";
import { reverseGeocodeHere } from "@/lib/here";
import { buildNearbyLoads } from "@/lib/nearby-loads";
import { aiBriefNearbyCached } from "@/lib/ai-nearby";

// GET /api/driver/nearby?lat=..&lng=..
// Where the driver is right now (city/state via HERE) plus their loads ranked
// by how far the truck is from the next stop, with an AI note per load.
// lat/lng are optional — the phone sends its live fix, otherwise we fall back
// to the last position the driver reported to /api/driver/location.

// Reverse geocoding barely changes as a truck rolls, and the app polls, so
// cache the lookup per ~1km square for a few minutes.
const GEO_TTL_MS = 10 * 60 * 1000;
const geoCache = new Map<string, { at: number; cityState: string }>();

async function cityStateFor(lat: number, lng: number): Promise<string> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const hit = geoCache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < GEO_TTL_MS) return hit.cityState;

  const r = await reverseGeocodeHere(lat, lng);
  const cityState = r ? [r.city, r.state].filter(Boolean).join(", ") : "";
  geoCache.set(key, { at: now, cityState });
  if (geoCache.size > 500) {
    for (const [k, v] of geoCache) {
      if (now - v.at > GEO_TTL_MS) geoCache.delete(k);
    }
  }
  return cityState;
}

export async function GET(req: Request) {
  const h = corsHeaders();
  const me = await requestUser(req);
  if (!me) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: h });
  }
  if (me.role !== "driver") {
    return NextResponse.json({ ok: false, error: "Drivers only" }, { status: 403, headers: h });
  }

  const { searchParams } = new URL(req.url);
  // Guard on the raw strings: Number(null) is 0, which would silently place a
  // driver with no live fix in the Atlantic instead of using their last ping.
  const rawLat = searchParams.get("lat");
  const rawLng = searchParams.get("lng");
  const qLat = Number(rawLat);
  const qLng = Number(rawLng);
  const live = Boolean(rawLat) && Boolean(rawLng) && Number.isFinite(qLat) && Number.isFinite(qLng);

  const stored = live ? null : getDriverGlobalLocation(me.email);
  const lat = live ? qLat : stored?.lat;
  const lng = live ? qLng : stored?.lng;

  if (typeof lat !== "number" || typeof lng !== "number") {
    // No GPS yet — the app shows the "turn on location" prompt instead.
    return NextResponse.json({ ok: true, location: null, loads: [], summary: "" }, { headers: h });
  }

  const cityState = await cityStateFor(lat, lng);
  const label = cityState || `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
  const loads = buildNearbyLoads(me.email, { lat, lng });

  const brief = await aiBriefNearbyCached(me.email, { lat, lng }, label, loads);
  const withNotes = loads.map((l) => ({ ...l, note: brief?.notes[l.id] || undefined }));

  return NextResponse.json(
    {
      ok: true,
      location: {
        lat,
        lng,
        cityState,
        label,
        live,
        at: live ? new Date().toISOString() : stored?.at || null,
      },
      loads: withNotes,
      summary: brief?.summary || "",
      ai: Boolean(brief),
    },
    { headers: h }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
