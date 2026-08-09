import type { NormalizedEldSnapshot } from "./types";

export type EldValidationError = { field: string; message: string };

function isBadDate(v: string): boolean {
  return Number.isNaN(new Date(v).getTime());
}

const HOUR_FIELDS = [
  "driveRemainingMin",
  "shiftRemainingMin",
  "cycleRemainingMin",
  "breakRemainingMin",
] as const;

// All-or-nothing: a single bad field means the WHOLE snapshot is invalid,
// not just that field. Silently dropping one bad value and keeping the
// rest would let a driver's real duty status stand next to a corrupted
// clock — worse than having no data at all for a compliance-adjacent
// feature. Negative minutes, out-of-range coordinates, and any field that
// doesn't parse as a real date are all rejected.
export function validateEldSnapshot(candidate: NormalizedEldSnapshot): EldValidationError[] {
  const errors: EldValidationError[] = [];

  if (!candidate.provider) errors.push({ field: "provider", message: "required" });
  if (!candidate.externalDriverId) errors.push({ field: "externalDriverId", message: "required" });

  for (const field of HOUR_FIELDS) {
    const v = candidate[field];
    if (v != null && (typeof v !== "number" || !Number.isFinite(v) || v < 0)) {
      errors.push({ field, message: "must be a non-negative number or null" });
    }
  }

  if (candidate.location) {
    const { lat, lng, at } = candidate.location;
    if (typeof lat !== "number" || lat < -90 || lat > 90) {
      errors.push({ field: "location.lat", message: "out of range" });
    }
    if (typeof lng !== "number" || lng < -180 || lng > 180) {
      errors.push({ field: "location.lng", message: "out of range" });
    }
    if (typeof at !== "string" || isBadDate(at)) {
      errors.push({ field: "location.at", message: "invalid date" });
    }
  }

  if (candidate.sourceUpdatedAt != null && isBadDate(candidate.sourceUpdatedAt)) {
    errors.push({ field: "sourceUpdatedAt", message: "invalid date" });
  }

  if (typeof candidate.fetchedAt !== "string" || isBadDate(candidate.fetchedAt)) {
    errors.push({ field: "fetchedAt", message: "invalid date" });
  }

  return errors;
}

// Throws on any validation error — the caller never receives a
// partially-trusted snapshot to work around.
export function assertValidEldSnapshot(candidate: NormalizedEldSnapshot): NormalizedEldSnapshot {
  const errors = validateEldSnapshot(candidate);
  if (errors.length > 0) {
    throw new Error(
      "Invalid ELD snapshot: " + errors.map((e) => `${e.field}: ${e.message}`).join("; ")
    );
  }
  return candidate;
}
