import type { LoadSourceProvider } from "@/lib/load-source-connections";

// What every load-board provider gets normalized into, regardless of how
// wildly different their raw API shapes are. Money is in cents (int, no
// float rounding); dates are ISO strings; anything a provider doesn't
// return comes through as null, never a guessed value.
export type NormalizedLoad = {
  provider: LoadSourceProvider;
  externalId: string;
  origin: string;
  destination: string;
  pickupDate: string | null;
  equipment: string | null;
  trailerLengthFt: number | null;
  miles: number | null;
  // Distance from the search origin to the load's pickup — what a
  // dispatcher means by "deadhead" when scanning results. Provider-supplied
  // only; never computed from a guess when a provider doesn't return it.
  deadheadMi: number | null;
  // Compass heading of the route (lib/truck-constants.ts DIRECTIONS: N/NE/
  // E/SE/S/SW/W/NW). Provider-supplied only — never inferred from origin/
  // destination city names, which is guessing, not normalizing.
  direction: string | null;
  rateCents: number | null;
  ratePerMileCents: number | null;
  broker: { name: string; contact: string } | null;
  // Deep link back to the load on the source platform — what a dispatcher
  // clicks to actually book it.
  originalUrl: string;
};

// Built from a driver's last-known GPS fix plus their saved search profile
// (lib/driver-search-profile.ts) — see lib/load-search.ts.
export type LoadSearchQuery = {
  originLat: number;
  originLng: number;
  radiusMi: number;
  equipment?: string | null;
  trailerLengthFt?: number | null;
  minRatePerMileCents?: number | null;
  preferredDirections?: string[];
};

// One adapter per provider. `active` is false until the integration is
// contractually approved and its real API verified against this shape —
// the search flow (lib/load-search.ts) never calls searchLoads on an
// inactive adapter, so a provider that isn't ready yet can't leak a network
// call or invented data into a result.
export interface LoadSourceAdapter {
  readonly provider: LoadSourceProvider;
  readonly active: boolean;
  searchLoads(query: LoadSearchQuery): Promise<NormalizedLoad[]>;
}
