import { getLoadsByDriverEmail, type GeoPoint, type Load } from "@/lib/loads";

// "What's near me right now" for a driver: their active loads ranked by how far
// the truck is from the next place it has to be — the pickup until the freight
// is on board, the delivery once it's rolling.

export type NearbyLoad = {
  id: string;
  ref: string;
  originName: string;
  destName: string;
  status: string;
  targetKind: "pickup" | "delivery";
  targetName: string; // address the miles below are measured to
  miles: number;
  rate: number | null;
  pickupDate?: string;
  deliveryDate?: string;
  note?: string; // short line written by the AI pass (lib/ai-nearby)
};

const DONE = new Set(["Delivered", "Closed"]);
const LOADED = new Set(["Picked Up", "In Transit", "At Delivery"]);

// Great-circle distance in miles between two lat/lng points.
export function milesBetween(a: GeoPoint, b: GeoPoint): number {
  const R = 3958.8; // earth radius, miles
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function target(load: Load): { kind: "pickup" | "delivery"; name: string; point: GeoPoint } {
  return LOADED.has(load.status)
    ? { kind: "delivery", name: load.destName, point: load.dest }
    : { kind: "pickup", name: load.originName, point: load.origin };
}

export function buildNearbyLoads(
  email: string,
  from: GeoPoint,
  opts: { radiusMiles?: number; limit?: number } = {}
): NearbyLoad[] {
  const radius = opts.radiusMiles ?? 500;
  const limit = opts.limit ?? 8;

  const ranked = getLoadsByDriverEmail(email)
    .filter((l) => !DONE.has(l.status))
    .map((l) => {
      const t = target(l);
      return {
        id: l.id,
        ref: l.ref,
        originName: l.originName,
        destName: l.destName,
        status: l.status,
        targetKind: t.kind,
        targetName: t.name,
        miles: Math.round(milesBetween(from, t.point)),
        rate: (l.driverRate ?? l.loadRate) ?? null,
        pickupDate: l.pickupDate,
        deliveryDate: l.deliveryDate,
      } satisfies NearbyLoad;
    })
    .sort((a, b) => a.miles - b.miles);

  const near = ranked.filter((l) => l.miles <= radius);
  // Everything is far away? Still show the closest one — an empty block reads
  // like the feature is broken, and the mileage on the card tells the truth.
  return (near.length > 0 ? near : ranked.slice(0, 1)).slice(0, limit);
}
