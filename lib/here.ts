import type { GeoPoint } from "@/lib/loads";

// Default rig: a standard US 53' trailer behind a tractor.
// HERE Routing v8 truck dimensions are in CENTIMETERS, weight in KILOGRAMS.
// Weight defaults to a light/partial load (~35,000 lb) so HERE doesn't avoid
// highways "just in case". Drivers set their real weight in the app settings.
const TRUCK = {
  height: 411, // 4.11 m
  width: 260, // 2.60 m
  length: 2200, // ~22 m tractor + 53' trailer
  grossWeight: 15876, // ~35,000 lb (light/partial load)
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
  // Use plain arithmetic (not 32-bit bitwise `<<`/`|`), because HERE precision-7
  // coordinates scale past 2^31 and would overflow a 32-bit int — flipping the
  // sign and throwing points into the wrong hemisphere (a line across the sea).
  // Doubles are exact to 2^53, well above any lat/lng * 10^7 value.
  const next = (): number => {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = FP_DEC[encoded[index++]];
      result += (b & 0x1f) * Math.pow(2, shift);
      shift += 5;
    } while (b & 0x20);
    return result;
  };
  // Zigzag decode without bitwise ops (which are 32-bit and would also overflow).
  const toSigned = (v: number) => (v % 2 ? -(v + 1) / 2 : v / 2);
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

// Reverse geocode coordinates → city/state (for "where is the driver now").
export async function reverseGeocodeHere(
  lat: number,
  lng: number
): Promise<{ city?: string; state?: string; label?: string } | null> {
  const key = process.env.HERE_API_KEY;
  if (!key) return null;
  const url =
    `https://revgeocode.search.hereapi.com/v1/revgeocode` +
    `?at=${lat},${lng}&lang=en-US&apikey=${key}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    const a = data?.items?.[0]?.address;
    if (!a) return null;
    return {
      city: a.city || a.county || undefined,
      state: a.stateCode || a.state || undefined,
      label: a.label || undefined,
    };
  } catch {
    return null;
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
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    const pos = data?.items?.[0]?.position;
    if (!pos || typeof pos.lat !== "number" || typeof pos.lng !== "number") return null;
    return { lat: pos.lat, lng: pos.lng };
  } catch {
    return null;
  }
}

// Great-circle distance in km between two lat/lng points.
function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Drop vertices that jump more than maxStepKm from the last kept vertex.
function despike(points: GeoPoint[], maxStepKm: number): GeoPoint[] {
  const out: GeoPoint[] = [];
  for (const p of points) {
    if (out.length === 0 || haversineKm(out[out.length - 1], p) <= maxStepKm) out.push(p);
  }
  return out;
}

export type TruckRoute = {
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteStep[];
  points: GeoPoint[]; // decoded route line for drawing on a map
};

// Calls HERE Routing v8 for a truck-legal route. Returns null on any failure or
// when no API key is configured, so callers can degrade gracefully.
export type TruckDims = {
  height?: number; // cm
  width?: number; // cm
  length?: number; // cm
  grossWeight?: number; // kg
  axleCount?: number;
};

export async function truckRoute(
  origin: GeoPoint,
  dest: GeoPoint,
  opts: { withSteps?: boolean; truck?: TruckDims; via?: GeoPoint[] } = {}
): Promise<TruckRoute | null> {
  const key = process.env.HERE_API_KEY;
  if (!key) return null;

  // Always request the polyline — the callers draw the route line and
  // truckRoute() returns null when it decodes zero points. "summary" alone has
  // no geometry, so a summary-only request would always yield null.
  const ret = opts.withSteps ? "summary,polyline,actions" : "summary,polyline";
  const t = opts.truck || {};
  const rig = {
    height: t.height && t.height > 0 ? t.height : TRUCK.height,
    width: t.width && t.width > 0 ? t.width : TRUCK.width,
    length: t.length && t.length > 0 ? t.length : TRUCK.length,
    grossWeight: t.grossWeight && t.grossWeight > 0 ? t.grossWeight : TRUCK.grossWeight,
    axleCount: t.axleCount && t.axleCount > 0 ? t.axleCount : TRUCK.axleCount,
  };
  const viaStr = (opts.via || [])
    .filter((p) => p && typeof p.lat === "number" && typeof p.lng === "number")
    .map((p) => `&via=${p.lat},${p.lng}`)
    .join("");
  const url =
    `https://router.hereapi.com/v8/routes` +
    `?transportMode=truck` +
    `&routingMode=fast` +
    `&origin=${origin.lat},${origin.lng}` +
    viaStr +
    `&destination=${dest.lat},${dest.lng}` +
    `&return=${ret}` +
    `&units=imperial` +
    `&truck[height]=${rig.height}` +
    `&truck[width]=${rig.width}` +
    `&truck[length]=${rig.length}` +
    `&truck[grossWeight]=${rig.grossWeight}` +
    `&truck[axleCount]=${rig.axleCount}` +
    `&apikey=${key}`;

  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    const sections = data?.routes?.[0]?.sections;
    if (!Array.isArray(sections) || sections.length === 0) return null;

    // Concatenate ALL sections so the drawn line is one continuous route
    // (HERE can split a route into several sections).
    const points: GeoPoint[] = [];
    const steps: RouteStep[] = [];
    let distanceMeters = 0;
    let durationSeconds = 0;

    for (const section of sections) {
      if (!section?.summary) continue;
      distanceMeters += Number(section.summary.length) || 0;
      durationSeconds += Number(section.summary.duration) || 0;

      const base = points.length; // offset within the combined points array
      const segPoints =
        typeof section.polyline === "string" ? decodeHerePolyline(section.polyline) : [];
      for (const p of segPoints) points.push(p);

      if (opts.withSteps && Array.isArray(section.actions)) {
        for (const a of section.actions) {
          if (a?.instruction) {
            const offset = Number(a.offset);
            const idx = Number.isFinite(offset) ? base + offset : -1;
            const point = idx >= 0 && points[idx] ? points[idx] : undefined;
            steps.push({
              text: String(a.instruction),
              lengthMeters: Number(a.length) || 0,
              point,
            });
          }
        }
      }
    }

    if (points.length === 0) return null;

    // Despike: HERE occasionally returns a section whose anchor coordinate is
    // corrupt (e.g. a flipped-sign longitude), throwing a run of points into
    // the wrong hemisphere — a line across the ocean. Drop any vertex that
    // teleports implausibly far from the last kept one; no real road step
    // between polyline vertices is hundreds of km. distance/duration come from
    // HERE's summary, so they stay correct regardless.
    const clean = despike(points, 400);

    return {
      distanceMeters,
      durationSeconds,
      steps,
      points: clean.length >= 2 ? clean : points,
    };
  } catch {
    return null;
  }
}
