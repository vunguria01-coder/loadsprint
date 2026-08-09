import type { DriverPing } from "@/lib/driver-location";
import type { DriverSearchProfile } from "@/lib/driver-search-profile";
import type { LoadSourceConnectionSummary, LoadSourceProvider } from "@/lib/load-source-connections";
import type { LoadSearchQuery, NormalizedLoad } from "@/lib/load-source-adapters";
import type { LoadProviderPolicy } from "@/lib/load-provider-policy";
import { readValid, purgeLoadCache } from "@/lib/load-cache";
import { getProviderPolicy } from "@/lib/load-provider-policy";

const DEFAULT_RADIUS_MI = 150;

// A driver's last GPS fix plus their saved search profile, turned into one
// query every adapter understands. Blank profile fields stay blank — this
// never invents a filter the dispatcher didn't set.
export function buildLoadSearchQuery(
  location: DriverPing,
  profile: DriverSearchProfile
): LoadSearchQuery {
  return {
    originLat: location.lat,
    originLng: location.lng,
    radiusMi: profile.deadheadRadiusMi ?? DEFAULT_RADIUS_MI,
    equipment: profile.equipment || null,
    trailerLengthFt: profile.trailerLengthFt ?? null,
    minRatePerMileCents:
      profile.minRatePerMile !== undefined ? Math.round(profile.minRatePerMile * 100) : null,
    preferredDirections: profile.preferredDirections,
  };
}

export type LoadSearchSourcesStatus =
  | "no_sources_connected"
  | "pending_provider_approval"
  | "ready";

export type LoadSearchResult = {
  loads: NormalizedLoad[];
  sourcesStatus: LoadSearchSourcesStatus;
};

// Hard filters from the driver's profile (via the query) — a load that
// fails one of these is dropped, not just ranked lower. A field the
// provider left unknown (null) can't be proven to satisfy a filter that's
// actually set, so it's excluded rather than assumed to pass.
function passesHardFilters(load: NormalizedLoad, query: LoadSearchQuery): boolean {
  if (query.equipment) {
    if (!load.equipment || load.equipment.toLowerCase() !== query.equipment.toLowerCase()) return false;
  }
  if (query.trailerLengthFt != null) {
    if (load.trailerLengthFt == null || load.trailerLengthFt > query.trailerLengthFt) return false;
  }
  if (query.minRatePerMileCents != null) {
    if (load.ratePerMileCents == null || load.ratePerMileCents < query.minRatePerMileCents) return false;
  }
  // radiusMi always has a value (buildLoadSearchQuery defaults it), so this
  // effectively always applies: a load whose deadhead is unknown, or known
  // and beyond the radius, doesn't pass.
  if (load.deadheadMi == null || load.deadheadMi > query.radiusMi) return false;
  if (query.preferredDirections && query.preferredDirections.length > 0) {
    if (!load.direction || !query.preferredDirections.includes(load.direction)) return false;
  }
  return true;
}

// Smaller deadhead first, then higher RPM first. Unknown deadhead sorts
// last (can't claim it's close); unknown RPM sorts last within its
// deadhead tier (can't claim it's a good rate).
function sortLoads(loads: NormalizedLoad[]): NormalizedLoad[] {
  return [...loads].sort((a, b) => {
    const dA = a.deadheadMi ?? Infinity;
    const dB = b.deadheadMi ?? Infinity;
    if (dA !== dB) return dA - dB;
    const rA = a.ratePerMileCents ?? -Infinity;
    const rB = b.ratePerMileCents ?? -Infinity;
    return rB - rA;
  });
}

// Reads lib/load-cache.ts — never calls a provider directly, so a search
// click costs nothing but a local read. The cache is only ever populated by
// lib/load-ingest.ts, which isn't wired into any route or job yet (no
// provider's caching terms are agreed in writing), so in production this
// still always resolves to "no_sources_connected" / "pending_provider_approval"
// with zero loads — same externally-visible behavior as before, now backed
// by a cache instead of a live per-request adapter call.
//
// allowDisplay is re-checked on every read, not just at ingest time: if a
// provider's display right is revoked after loads were already cached, this
// hides them on the very next search — no re-fetch or cache purge needed.
export async function runLoadSearch(
  query: LoadSearchQuery,
  connections: LoadSourceConnectionSummary[],
  ownerId: string,
  policyFor: (provider: LoadSourceProvider) => LoadProviderPolicy = getProviderPolicy
): Promise<LoadSearchResult> {
  const saved = connections.filter((c) => c.status === "credentials_saved");
  if (saved.length === 0) {
    return { loads: [], sourcesStatus: "no_sources_connected" };
  }

  purgeLoadCache(policyFor);

  const displayable = saved.filter((c) => policyFor(c.provider).allowDisplay);
  const perProvider = await Promise.all(displayable.map((c) => readValid(ownerId, c.provider)));
  const cached = perProvider.flat();
  if (cached.length === 0) {
    return { loads: [], sourcesStatus: "pending_provider_approval" };
  }

  const filtered = cached.filter((l) => passesHardFilters(l, query));
  return { loads: sortLoads(filtered), sourcesStatus: "ready" };
}
