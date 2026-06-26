import type { GeoPoint } from "@/lib/loads";

// Default rig: a standard US 53' trailer behind a tractor.
// HERE Routing v8 truck dimensions are in CENTIMETERS, weight in KILOGRAMS.
const TRUCK = {
  height: 411, // 4.11 m
  width: 260, // 2.60 m
  length: 2200, // ~22 m tractor + 53' trailer
  grossWeight: 36287, // ~80,000 lb
  axleCount: 5,
};

export type RouteStep = { text: string; lengthMeters: number; point?: GeoPoint };

// HERE returns the route geometry as a "flexible polyline" string. Decode it
// into lat/lng points so the mobile app can draw the route on a map.
const FP_ENCODING = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
const FP_DEC: Record<string, number> = {};
for (let i = 0; i < FP_ENCODING.length; i++) FP_DEC[FP_ENCODING[i]] = i;

function decodeHerePolyline(encoded: string): GeoPoint[] {
  let index = 0;
  const next = (): number => {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = FP_DEC[encoded[index++]];
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b & 0x20);
    return result;
  };
  const toSigned = (v: number) => (v & 1 ? ~(v >> 1) : v >> 1);
  try {
    next(); // header version
    const headerContent = next();
    const precision = headerContent & 15;
    const thirdDim = (headerContent >> 4) & 7;
    const factor = Math.pow(10, precision);
    const points: GeoPoint[] = [];
    let lat = 0;
    let lng = 0;
    while (index < encoded.length) {
      lat += toSigned(next());
      lng += toSigned(next());
      if (thirdDim) next(); // skip elevation/3rd dimension
      points.push({ lat: lat / factor, lng: lng / factor });
    }
    return points;
  } catch {
    return [];
  }
}

// Convert a free-form address ("123 Main St, Dallas, TX") into coordinates via
// HERE Geocoding. Returns null if no key, no result, or on error.
export async function geocodeHere(address: string): Promise<GeoPoint | null> {
  const key = process.env.HERE_API_KEY;
  if (!key || !address.trim()) return null;
  const url =
    `https://geocode.search.hereapi.com/v1/geocode` +
    `?q=${encodeURIComponent(address.trim())}` +
    `&in=countryCode:USA,CAN` +
    `&limit=1` +
    `&apikey=${key}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const pos = data?.items?.[0]?.position;
    if (!pos || typeof pos.lat !== "number" || typeof pos.lng !== "number") return null;
    return { lat: pos.lat, lng: pos.lng };
  } catch {
    return null;
  }
}

export type TruckRoute = {
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteStep[];
  points: GeoPoint[]; // decoded route line for drawing on a map
};

// Calls HERE Routing v8 for a truck-legal route. Returns null on any failure or
// when no API key is configured, so callers can degrade gracefully.
export async function truckRoute(
  origin: GeoPoint,
  dest: GeoPoint,
  opts: { withSteps?: boolean } = {}
): Promise<TruckRoute | null> {
  const key = process.env.HERE_API_KEY;
  if (!key) return null;

  const ret = opts.withSteps ? "summary,polyline,actions" : "summary";
  const url =
    `https://router.hereapi.com/v8/routes` +
    `?transportMode=truck` +
    `&origin=${origin.lat},${origin.lng}` +
    `&destination=${dest.lat},${dest.lng}` +
    `&return=${ret}` +
    `&units=imperial` +
    `&truck[height]=${TRUCK.height}` +
    `&truck[width]=${TRUCK.width}` +
    `&truck[length]=${TRUCK.length}` +
    `&truck[grossWeight]=${TRUCK.grossWeight}` +
    `&truck[axleCount]=${TRUCK.axleCount}` +
    `&apikey=${key}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const section = data?.routes?.[0]?.sections?.[0];
    if (!section?.summary) return null;

    const points: GeoPoint[] =
      typeof section.polyline === "string" ? decodeHerePolyline(section.polyline) : [];

    const steps: RouteStep[] = [];
    if (opts.withSteps && Array.isArray(section.actions)) {
      for (const a of section.actions) {
        if (a?.instruction) {
          const offset = Number(a.offset);
          const point =
            Number.isFinite(offset) && points[offset] ? points[offset] : undefined;
          steps.push({
            text: String(a.instruction),
            lengthMeters: Number(a.length) || 0,
            point,
          });
        }
      }
    }

    return {
      distanceMeters: Number(section.summary.length) || 0,
      durationSeconds: Number(section.summary.duration) || 0,
      steps,
      points,
    };
  } catch {
    return null;
  }
}
