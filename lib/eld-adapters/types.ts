// Provider-neutral ELD/HOS layer — mirrors lib/load-source-adapters/ on
// purpose (same shape of problem: normalize wildly different vendor APIs
// into one strict type, gate everything behind an inactive-by-default
// registry, keep fixture data out of production). See
// docs/eld-providers-research.md for which vendors this maps to
// (Motive/Samsara/Geotab/Verizon Connect) — none of them are wired up yet.

export const ELD_PROVIDERS = ["motive", "samsara", "geotab", "verizon_connect"] as const;
export type EldProvider = (typeof ELD_PROVIDERS)[number];

// "unknown" is a real, distinct duty status a provider can report (e.g. the
// ELD hasn't checked in) — it is NOT what this layer uses for "we don't
// know the value." Every other field below uses null for that.
export const DUTY_STATUSES = [
  "off_duty",
  "sleeper",
  "driving",
  "on_duty",
  "yard_move",
  "personal_conveyance",
  "unknown",
] as const;
export type DutyStatus = (typeof DUTY_STATUSES)[number];

// Coordinates carry their OWN timestamp — when the vehicle/device actually
// was there — which is not the same moment as when LoadSprint fetched the
// snapshot (see NormalizedEldSnapshot.fetchedAt) or when the provider's
// backend last recomputed HOS clocks (sourceUpdatedAt).
export type EldLocation = {
  lat: number;
  lng: number;
  at: string;
};

// Every field a provider didn't return comes through as null — never
// computed, never defaulted to 0. A driver with "0 minutes drive time
// remaining" and a driver whose provider simply didn't report drive time
// are different facts; collapsing them would be a compliance-relevant lie.
export type NormalizedEldSnapshot = {
  provider: EldProvider;
  externalDriverId: string;
  externalVehicleId: string | null;
  vehicleName: string | null;
  vehicleVin: string | null;
  dutyStatus: DutyStatus;
  driveRemainingMin: number | null;
  shiftRemainingMin: number | null;
  cycleRemainingMin: number | null;
  breakRemainingMin: number | null;
  location: EldLocation | null;
  // When the provider's own system last recomputed this data (its
  // server-side "as of" time) — independent of when we happened to poll it.
  sourceUpdatedAt: string | null;
  // When LoadSprint actually fetched this snapshot.
  fetchedAt: string;
};

// One entry per driver the provider knows about — used to let a dispatcher
// pick which ELD driver record a LoadSprint driver actually corresponds
// to, and (critically) to let lib/eld-driver-links.ts verify a client-
// supplied externalDriverId is real before ever linking it. name is
// whatever the provider itself uses to identify the driver (comes back
// non-empty); the vehicle fields follow the same "null means unknown"
// convention as everything else in this layer.
export type NormalizedEldDriver = {
  externalDriverId: string;
  name: string;
  externalVehicleId: string | null;
  vehicleName: string | null;
};

// What a saved credential actually turns out to be allowed to do, per the
// provider's own answer — never assumed from "credentials_saved" alone.
// Each flag maps to one thing this codebase can do with the connection:
// drivers_read gates listDrivers()/linking, hos_read gates
// fetchSnapshot()/refreshEldSnapshot(). vehicles_read and locations_read
// aren't consumed by anything yet but are recorded now so a future feature
// doesn't have to re-verify the connection just to check them.
export type EldCapabilities = {
  drivers_read: boolean;
  vehicles_read: boolean;
  hos_read: boolean;
  locations_read: boolean;
};

// What a successful verifyConnection call proves: which provider account
// the credential actually belongs to, and exactly what it's allowed to
// read. lib/eld-connections.ts is what turns this into a stored
// "verified" state tied to a specific credentials revision.
export type EldVerification = {
  accountId: string;
  capabilities: EldCapabilities;
};

// One adapter per provider. `active` is false until the integration is
// contractually approved and its real API verified against this shape —
// same fail-closed convention as lib/load-source-adapters. Every method
// takes an AbortSignal from day one, not bolted on later: a caller with a
// request timeout (or a user who navigated away) must be able to cancel an
// in-flight ELD call the same way it can cancel a load-source fetch.
export interface EldAdapter {
  readonly provider: EldProvider;
  readonly active: boolean;
  // The most external driver ids a single fetchSnapshots() call may
  // request at once — whatever the provider's own API actually allows.
  // lib/eld-refresh-job.ts chunks a group's drivers to this size and never
  // guesses at a larger or smaller number.
  readonly maxBatchSize: number;
  // Proves a saved credential actually works and reports what it can do —
  // called once right after a credential is saved (and again whenever it's
  // replaced), never implied by the credential merely having been stored.
  verifyConnection(credential: string, signal?: AbortSignal): Promise<EldVerification>;
  fetchSnapshot(externalDriverId: string, signal?: AbortSignal): Promise<NormalizedEldSnapshot>;
  // Fleet-level batch fetch — one call for up to maxBatchSize drivers under
  // ONE owner+provider, instead of one HTTP round trip per driver. Unlike
  // fetchSnapshot, this DOES take the credential explicitly: a batch call
  // authenticates once for the whole group, not once per driver.
  fetchSnapshots(
    credential: string,
    externalDriverIds: string[],
    signal?: AbortSignal
  ): Promise<NormalizedEldSnapshot[]>;
  listDrivers(signal?: AbortSignal): Promise<NormalizedEldDriver[]>;
}
