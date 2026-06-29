import { geocodeHere } from "@/lib/here";
import { geocodeCity, setStops, type Load } from "@/lib/loads";

// Make sure every stop on a load has coordinates so it can be drawn on the map
// and used as a routing waypoint. Geocodes only the stops that are missing a
// point (idempotent + cheap on repeat calls), falling back to a city-level
// lookup when the precise geocoder has no answer, then persists the result.
export async function ensureStopsGeocoded(load: Load): Promise<Load> {
  const stops = load.stops;
  if (!stops || stops.length === 0) return load;
  if (!stops.some((s) => !s.point)) return load; // already complete

  const filled = await Promise.all(
    stops.map(async (s) => {
      if (s.point) return s;
      const point = (await geocodeHere(s.address)) || geocodeCity(s.address);
      return { ...s, point };
    })
  );

  return setStops(load.id, filled) ?? { ...load, stops: filled };
}
