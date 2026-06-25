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

export type RouteStep = { text: string; lengthMeters: number };

export type TruckRoute = {
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteStep[];
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

  const ret = opts.withSteps ? "summary,actions,instructions" : "summary";
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

    const steps: RouteStep[] = [];
    if (opts.withSteps && Array.isArray(section.actions)) {
      for (const a of section.actions) {
        if (a?.instruction) {
          steps.push({
            text: String(a.instruction),
            lengthMeters: Number(a.length) || 0,
          });
        }
      }
    }

    return {
      distanceMeters: Number(section.summary.length) || 0,
      durationSeconds: Number(section.summary.duration) || 0,
      steps,
    };
  } catch {
    return null;
  }
}
